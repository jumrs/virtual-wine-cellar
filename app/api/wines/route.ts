/**
 * Wines API Routes
 * CRUD operations for user wine collection
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
  sanitizeWineData,
  validateImageFile,
  generateSafeFilename,
  isValidUUID,
} from "@/lib/security";

/**
 * GET /api/wines - Fetch user's wine collection
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:get:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;

    // Fetch wines with all fields including grapes
    const { data: wines, error } = await authenticatedSupabase
      .from("user_wines")
      .select(`
        id,
        quantity,
        date_added,
        wines (
          id,
          name,
          type,
          grape,
          grapes,
          is_blend,
          region,
          country,
          vintage,
          score,
          label_image_url,
          notes
        )
      `)
      .eq("user_id", user.id)
      .order("date_added", { ascending: false });

    if (error) {
      // Fallback query without quantity if column doesn't exist
      if (error.code === "42703" && error.message?.includes("quantity")) {
        console.warn("Quantity column missing, fetching without it");
        const { data: fallbackWines, error: fallbackError } = await authenticatedSupabase
          .from("user_wines")
          .select(`
            id,
            date_added,
            wines (
              id, name, type, grape, grapes, is_blend,
              region, country, vintage, score, label_image_url, notes
            )
          `)
          .eq("user_id", user.id)
          .order("date_added", { ascending: false });

        if (fallbackError) throw fallbackError;

        const formatted = formatWineResponse(fallbackWines, false);
        return successResponse(formatted, { cacheDuration: 30, staleWhileRevalidate: 60 });
      }
      throw error;
    }

    const formatted = formatWineResponse(wines, true);
    return successResponse(formatted, { cacheDuration: 30, staleWhileRevalidate: 60 });
  } catch (error) {
    logApiError("GET /api/wines", error);
    return errorResponse("Failed to fetch wines");
  }
}

/**
 * POST /api/wines - Add new wine to collection
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:post:${clientId}`, RATE_LIMITS.upload);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const wineDataStr = formData.get("wineData") as string;

    if (!wineDataStr) {
      return errorResponse("Missing wine data", 400);
    }

    let rawWineData;
    try {
      rawWineData = JSON.parse(wineDataStr);
    } catch {
      return errorResponse("Invalid wine data format", 400);
    }

    // Sanitize wine data
    const wineData = sanitizeWineData(rawWineData);

    // Validate required field
    if (!wineData.name || typeof wineData.name !== "string" || wineData.name.length < 1) {
      return errorResponse("Wine name is required", 400);
    }

    // Upload image if provided
    let imageUrl: string | undefined;
    if (file && file.size > 0) {
      // Validate file
      const fileValidation = validateImageFile(file, 10);
      if (!fileValidation.valid) {
        return errorResponse(fileValidation.error || "Invalid image file", 400);
      }
      imageUrl = await uploadWineImage(authenticatedSupabase, user.id, file);
    }

    // Process grapes array
    const grapes = normalizeGrapes(wineData.grapes as string[] | undefined, wineData.grape as string | undefined);
    const isBlend = grapes.length > 1;

    // Insert wine
    const { data: wine, error: wineError } = await authenticatedSupabase
      .from("wines")
      .insert({
        name: wineData.name,
        type: wineData.type || null,
        grape: grapes.length > 0 ? grapes.join(", ") : null,
        grapes,
        is_blend: isBlend,
        region: wineData.region || null,
        country: wineData.country || null,
        vintage: wineData.vintage || null,
        score: wineData.score ?? null,
        label_image_url: imageUrl || null,
        notes: wineData.notes || null,
      })
      .select()
      .single();

    if (wineError) {
      logApiError("Insert wine", wineError);
      return errorResponse(`Database error: ${wineError.message}`, 500);
    }

    // Link wine to user
    const quantity = Math.max(1, wineData.quantity || 1);
    const { error: linkError } = await authenticatedSupabase
      .from("user_wines")
      .insert({
        user_id: user.id,
        wine_id: wine.id,
        quantity,
      });

    if (linkError) {
      // Cleanup on failure
      await authenticatedSupabase.from("wines").delete().eq("id", wine.id);
      logApiError("Link wine to user", linkError);
      return errorResponse(`Failed to link wine: ${linkError.message}`, 500);
    }

    return successResponse({ success: true, wine });
  } catch (error: any) {
    logApiError("POST /api/wines", error);
    return errorResponse(error.message || "Failed to save wine");
  }
}

/**
 * PUT /api/wines?id=<wineId> - Update wine details
 */
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:put:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const wineId = getQueryParam(request, "id");

    if (!wineId) {
      return errorResponse("Wine ID is required", 400);
    }

    // Validate wine ID format
    if (!isValidUUID(wineId)) {
      return errorResponse("Invalid wine ID format", 400);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    // Sanitize input data
    const sanitized = sanitizeWineData(body);
    const { name, type, grape, grapes, region, country, vintage, score, notes, quantity } = {
      ...body,
      ...sanitized,
    };

    if (!name) {
      return errorResponse("Wine name is required", 400);
    }

    // Verify ownership
    const { data: userWine, error: checkError } = await authenticatedSupabase
      .from("user_wines")
      .select("id")
      .eq("user_id", user.id)
      .eq("wine_id", wineId)
      .single();

    if (checkError || !userWine) {
      return errorResponse("Wine not found or access denied", 404);
    }

    // Process grapes
    const processedGrapes = normalizeGrapes(grapes, grape);
    const isBlend = processedGrapes.length > 1;

    // Update wine
    const { data: updatedWine, error: updateError } = await authenticatedSupabase
      .from("wines")
      .update({
        name,
        type: type || null,
        grape: processedGrapes.length > 0 ? processedGrapes.join(", ") : null,
        grapes: processedGrapes,
        is_blend: isBlend,
        region: region || null,
        country: country || null,
        vintage: vintage || null,
        score: score ?? null,
        notes: notes || null,
      })
      .eq("id", wineId)
      .select()
      .single();

    if (updateError) {
      logApiError("Update wine", updateError);
      return errorResponse(`Failed to update: ${updateError.message}`, 500);
    }

    // Update quantity
    if (quantity !== undefined) {
      await authenticatedSupabase
        .from("user_wines")
        .update({ quantity: Math.max(0, quantity) })
        .eq("user_id", user.id)
        .eq("wine_id", wineId);
    }

    return successResponse({ success: true, wine: updatedWine });
  } catch (error: any) {
    logApiError("PUT /api/wines", error);
    return errorResponse(error.message || "Failed to update wine");
  }
}

/**
 * DELETE /api/wines?id=<wineId> - Remove wine from collection
 */
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:delete:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const wineId = getQueryParam(request, "id");

    if (!wineId) {
      return errorResponse("Wine ID is required", 400);
    }

    // Validate wine ID format
    if (!isValidUUID(wineId)) {
      return errorResponse("Invalid wine ID format", 400);
    }

    const { error } = await authenticatedSupabase
      .from("user_wines")
      .delete()
      .eq("user_id", user.id)
      .eq("wine_id", wineId);

    if (error) {
      throw error;
    }

    return successResponse({ success: true });
  } catch (error) {
    logApiError("DELETE /api/wines", error);
    return errorResponse("Failed to delete wine");
  }
}

// ============ Helper Functions ============

/**
 * Format wine response from database join
 */
function formatWineResponse(wines: any[] | null, hasQuantity: boolean) {
  return (
    wines?.map((uw: any) => ({
      id: uw.wines.id,
      name: uw.wines.name,
      type: uw.wines.type,
      grape: uw.wines.grape,
      grapes: uw.wines.grapes ?? [],
      is_blend: uw.wines.is_blend ?? (uw.wines.grapes?.length > 1 || false),
      region: uw.wines.region,
      country: uw.wines.country,
      vintage: uw.wines.vintage,
      score: uw.wines.score ?? null,
      label_image_url: uw.wines.label_image_url,
      notes: uw.wines.notes,
      date_added: uw.date_added,
      quantity: hasQuantity ? (uw.quantity ?? 1) : 1,
    })) || []
  );
}

/**
 * Upload wine image to storage
 */
async function uploadWineImage(
  supabase: ReturnType<typeof import("@/lib/supabaseServer").createAuthenticatedClient>,
  userId: string,
  file: File
): Promise<string | undefined> {
  try {
    // Generate safe filename
    const fileName = generateSafeFilename(userId, file.name);
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("wine-labels")
      .upload(fileName, fileBuffer, { contentType: file.type });

    if (uploadError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Image upload error:", uploadError);
      }
      return undefined;
    }

    const { data: urlData } = supabase.storage
      .from("wine-labels")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Image upload failed:", error);
    }
    return undefined;
  }
}

/**
 * Normalize grapes input to array
 */
function normalizeGrapes(grapes: unknown, grape?: string): string[] {
  if (Array.isArray(grapes)) {
    return grapes.filter(Boolean);
  }
  if (grape) {
    return grape
      .split(/[\/,+]|\s+and\s+/i)
      .map((g: string) => g.trim())
      .filter(Boolean);
  }
  return [];
}
