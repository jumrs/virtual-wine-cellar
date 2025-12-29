/**
 * Cellar Members API Routes
 * Manage cellar membership
 */

import { NextRequest } from "next/server";
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

/**
 * GET /api/cellars/members?cellarId=<id> - Get members of a cellar
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-members:get:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const cellarId = getQueryParam(request, "cellarId");

    if (!cellarId) {
      return errorResponse("Cellar ID is required", 400);
    }

    if (!isValidUUID(cellarId)) {
      return errorResponse("Invalid cellar ID format", 400);
    }

    // Verify user has access to this cellar
    const { data: membership, error: membershipError } = await authenticatedSupabase
      .from("cellar_members")
      .select("id")
      .eq("cellar_id", cellarId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return errorResponse("Access denied to this cellar", 403);
    }

    // Fetch all members with profile info
    const { data: members, error: membersError } = await authenticatedSupabase
      .from("cellar_members")
      .select(`
        id,
        cellar_id,
        user_id,
        role,
        added_at,
        profiles:user_id (
          id,
          email,
          name,
          username,
          avatar_url
        )
      `)
      .eq("cellar_id", cellarId)
      .order("added_at", { ascending: true });

    if (membersError) {
      throw membersError;
    }

    // Format response - flatten profile data
    const formattedMembers = members?.map((m: any) => ({
      id: m.id,
      cellar_id: m.cellar_id,
      user_id: m.user_id,
      role: m.role,
      added_at: m.added_at,
      user: m.profiles || null,
    })) || [];

    return successResponse(formattedMembers);
  } catch (error) {
    logApiError("GET /api/cellars/members", error);
    return errorResponse("Failed to fetch members");
  }
}

/**
 * DELETE /api/cellars/members?cellarId=<id>&userId=<id> - Remove member from cellar
 */
export async function DELETE(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-members:delete:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const cellarId = getQueryParam(request, "cellarId");
    const targetUserId = getQueryParam(request, "userId");

    if (!cellarId || !targetUserId) {
      return errorResponse("Cellar ID and User ID are required", 400);
    }

    if (!isValidUUID(cellarId) || !isValidUUID(targetUserId)) {
      return errorResponse("Invalid ID format", 400);
    }

    // Get cellar info
    const { data: cellar, error: cellarError } = await authenticatedSupabase
      .from("cellars")
      .select("owner_id")
      .eq("id", cellarId)
      .single();

    if (cellarError || !cellar) {
      return errorResponse("Cellar not found", 404);
    }

    // Check permissions
    const isOwner = cellar.owner_id === user.id;
    const isSelf = targetUserId === user.id;

    // Only owner can remove others, anyone can remove themselves
    if (!isOwner && !isSelf) {
      return errorResponse("Only the owner can remove other members", 403);
    }

    // Owner cannot remove themselves
    if (isOwner && isSelf) {
      return errorResponse("Owner cannot leave their own cellar. Transfer ownership or delete the cellar instead.", 400);
    }

    // Remove the member
    const { error: deleteError } = await authenticatedSupabase
      .from("cellar_members")
      .delete()
      .eq("cellar_id", cellarId)
      .eq("user_id", targetUserId);

    if (deleteError) {
      throw deleteError;
    }

    return successResponse({ success: true });
  } catch (error) {
    logApiError("DELETE /api/cellars/members", error);
    return errorResponse("Failed to remove member");
  }
}

