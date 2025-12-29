/**
 * Cellars API Routes
 * CRUD operations for wine cellars
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
  successResponse,
  getQueryParam,
  logApiError,
} from "@/lib/apiUtils";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  isValidUUID,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/cellars - Fetch user's cellars
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellars:get:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;

    // Fetch all cellars the user is a member of
    const { data: memberships, error: membershipError } = await authenticatedSupabase
      .from("cellar_members")
      .select(`
        role,
        cellar:cellars (
          id,
          name,
          owner_id,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", user.id);

    if (membershipError) {
      // If cellar_members table doesn't exist yet, return empty array
      if (membershipError.code === "42P01") {
        return successResponse([]);
      }
      throw membershipError;
    }

    // Get member counts for each cellar
    const cellarIds = memberships
      ?.map((m: any) => m.cellar?.id)
      .filter(Boolean) || [];

    let memberCounts: Record<string, number> = {};
    if (cellarIds.length > 0) {
      const { data: counts } = await authenticatedSupabase
        .from("cellar_members")
        .select("cellar_id")
        .in("cellar_id", cellarIds);

      if (counts) {
        memberCounts = counts.reduce((acc: Record<string, number>, row: any) => {
          acc[row.cellar_id] = (acc[row.cellar_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Format response
    const cellars = memberships?.map((m: any) => ({
      ...m.cellar,
      role: m.role,
      member_count: memberCounts[m.cellar?.id] || 1,
      is_shared: (memberCounts[m.cellar?.id] || 1) > 1,
    })) || [];

    const response = successResponse(cellars);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    logApiError("GET /api/cellars", error);
    return errorResponse("Failed to fetch cellars");
  }
}

/**
 * POST /api/cellars - Create a new cellar
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellars:post:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { name } = body;
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return errorResponse("Cellar name is required", 400);
    }

    if (name.length > 100) {
      return errorResponse("Cellar name must be 100 characters or less", 400);
    }

    // Create the cellar
    const { data: cellar, error: cellarError } = await authenticatedSupabase
      .from("cellars")
      .insert({
        name: name.trim(),
        owner_id: user.id,
      })
      .select()
      .single();

    if (cellarError) {
      logApiError("Create cellar", cellarError);
      return errorResponse(`Failed to create cellar: ${cellarError.message}`, 500);
    }

    // Add user as owner member
    const { error: memberError } = await authenticatedSupabase
      .from("cellar_members")
      .insert({
        cellar_id: cellar.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      // Cleanup on failure
      await authenticatedSupabase.from("cellars").delete().eq("id", cellar.id);
      logApiError("Add owner member", memberError);
      return errorResponse(`Failed to create cellar: ${memberError.message}`, 500);
    }

    return successResponse({
      success: true,
      cellar: {
        ...cellar,
        role: "owner",
        member_count: 1,
        is_shared: false,
      },
    });
  } catch (error: any) {
    logApiError("POST /api/cellars", error);
    return errorResponse(error.message || "Failed to create cellar");
  }
}

/**
 * PUT /api/cellars?id=<cellarId> - Update cellar details
 */
export async function PUT(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellars:put:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const cellarId = getQueryParam(request, "id");

    if (!cellarId) {
      return errorResponse("Cellar ID is required", 400);
    }

    if (!isValidUUID(cellarId)) {
      return errorResponse("Invalid cellar ID format", 400);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { name } = body;
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return errorResponse("Cellar name is required", 400);
    }

    // Verify ownership
    const { data: cellar, error: checkError } = await authenticatedSupabase
      .from("cellars")
      .select("id, owner_id")
      .eq("id", cellarId)
      .single();

    if (checkError || !cellar) {
      return errorResponse("Cellar not found", 404);
    }

    if (cellar.owner_id !== user.id) {
      return errorResponse("Only the owner can update this cellar", 403);
    }

    // Update cellar
    const { data: updatedCellar, error: updateError } = await authenticatedSupabase
      .from("cellars")
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", cellarId)
      .select()
      .single();

    if (updateError) {
      logApiError("Update cellar", updateError);
      return errorResponse(`Failed to update: ${updateError.message}`, 500);
    }

    return successResponse({ success: true, cellar: updatedCellar });
  } catch (error: any) {
    logApiError("PUT /api/cellars", error);
    return errorResponse(error.message || "Failed to update cellar");
  }
}

/**
 * DELETE /api/cellars?id=<cellarId> - Delete a cellar
 */
export async function DELETE(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellars:delete:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const cellarId = getQueryParam(request, "id");

    if (!cellarId) {
      return errorResponse("Cellar ID is required", 400);
    }

    if (!isValidUUID(cellarId)) {
      return errorResponse("Invalid cellar ID format", 400);
    }

    // Verify ownership
    const { data: cellar, error: checkError } = await authenticatedSupabase
      .from("cellars")
      .select("id, owner_id")
      .eq("id", cellarId)
      .single();

    if (checkError || !cellar) {
      return errorResponse("Cellar not found", 404);
    }

    if (cellar.owner_id !== user.id) {
      return errorResponse("Only the owner can delete this cellar", 403);
    }

    // Check if this is the user's only cellar
    const { data: userCellars } = await authenticatedSupabase
      .from("cellar_members")
      .select("cellar_id")
      .eq("user_id", user.id);

    if (userCellars && userCellars.length <= 1) {
      return errorResponse("Cannot delete your only cellar", 400);
    }

    // Delete cellar (cascade will handle members, wines, invites)
    const { error: deleteError } = await authenticatedSupabase
      .from("cellars")
      .delete()
      .eq("id", cellarId);

    if (deleteError) {
      logApiError("Delete cellar", deleteError);
      return errorResponse(`Failed to delete: ${deleteError.message}`, 500);
    }

    return successResponse({ success: true });
  } catch (error) {
    logApiError("DELETE /api/cellars", error);
    return errorResponse("Failed to delete cellar");
  }
}

