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
import { fetchCellarWines } from "@/lib/cellarWines";

// This route is user-specific and must never be cached across sessions/users.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/wines - Fetch user's wine collection
 * Query params:
 * - cellarId: Fetch wines for a specific cellar (optional, defaults to legacy user_wines lookup)
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
    const cellarId = getQueryParam(request, "cellarId");

    // If cellarId is provided, use cellar-based query
    if (cellarId) {
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

      // Get the cellar owner first
      const { data: cellar } = await authenticatedSupabase
        .from("cellars")
        .select("owner_id")
        .eq("id", cellarId)
        .single();

      if (!cellar?.owner_id) {
        return errorResponse("Cellar owner not found", 404);
      }

      const formatted = await fetchCellarWines(authenticatedSupabase, cellarId, cellar.owner_id);

      const response = successResponse(formatted);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Vary", "Authorization");
      return response;
    }

    // No cellarId (profile stats, search): wines across all cellars the user owns.
    // Excludes cellars where the user is only admin/member, and wines with no cellar.
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
          user_uploaded_label_url,
          notes,
          cellar_id
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
              region, country, vintage, score, label_image_url, user_uploaded_label_url, notes, cellar_id
            )
          `)
          .eq("user_id", user.id)
          .order("date_added", { ascending: false });

        if (fallbackError) throw fallbackError;

        // Filter to only include wines from cellars where user is owner
        const filtered = await filterWinesByOwnership(authenticatedSupabase, user.id, fallbackWines);
        const formatted = formatWineResponse(filtered, false);
        const response = successResponse(formatted);
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("Vary", "Authorization");
        return response;
      }
      throw error;
    }

    // Filter to only include wines from cellars where user is owner (not admin)
    const filtered = await filterWinesByOwnership(authenticatedSupabase, user.id, wines);
    const formatted = formatWineResponse(filtered, true);
    const response = successResponse(formatted);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Vary", "Authorization");
    return response;
  } catch (error) {
    logApiError("GET /api/wines", error);
    return errorResponse("Failed to fetch wines");
  }
}

/**
 * POST /api/wines - Add new wine to collection
 * Body params (in wineData JSON):
 * - cellarId: Add wine to a specific cellar (optional, falls back to user_wines for backward compat)
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
    const cellarId = rawWineData.cellarId;

    // Validate required field
    if (!wineData.name || typeof wineData.name !== "string" || wineData.name.length < 1) {
      return errorResponse("Wine name is required", 400);
    }

    // If cellarId is provided, verify access and permissions
    let cellarOwnerId: string | null = null;
    if (cellarId) {
      if (!isValidUUID(cellarId)) {
        return errorResponse("Invalid cellar ID format", 400);
      }

      // Check membership and role
      const { data: membership, error: membershipError } = await authenticatedSupabase
        .from("cellar_members")
        .select("role")
        .eq("cellar_id", cellarId)
        .eq("user_id", user.id)
        .single();

      if (membershipError || !membership) {
        return errorResponse("Access denied to this cellar", 403);
      }

      // Only owner and admin can add wines
      // Members have read-only access
      if (membership.role !== "owner" && membership.role !== "admin") {
        return errorResponse("You don't have permission to add wines. Members have read-only access.", 403);
      }

      // Get cellar owner for user_wines record
      const { data: cellar } = await authenticatedSupabase
        .from("cellars")
        .select("owner_id")
        .eq("id", cellarId)
        .single();

      cellarOwnerId = cellar?.owner_id || null;
    }

    // Upload user's scanned label image if provided
    let userUploadedLabelUrl: string | undefined;
    if (file && file.size > 0) {
      // Validate file
      const fileValidation = validateImageFile(file, 10);
      if (!fileValidation.valid) {
        return errorResponse(fileValidation.error || "Invalid image file", 400);
      }
      userUploadedLabelUrl = await uploadWineImage(authenticatedSupabase, user.id, file);
    }

    // Get standardized image URL from wine data (set by scanWine endpoint)
    // Fall back to user uploaded image if no standardized image is available
    const standardImageUrl = rawWineData.standard_image_url || rawWineData.label_image_url || null;
    const finalLabelImageUrl = standardImageUrl || userUploadedLabelUrl || null;

    // Process grapes array
    const grapes = normalizeGrapes(wineData.grapes as string[] | undefined, wineData.grape as string | undefined);
    const isBlend = grapes.length > 1;

    // Calculate quantity early as it's needed for both paths
    const rawQuantity = wineData.quantity;
    const quantityNum = typeof rawQuantity === "number" ? rawQuantity :
      (typeof rawQuantity === "string" ? parseInt(rawQuantity, 10) : 1);
    const quantity = Math.max(1, isNaN(quantityNum) ? 1 : quantityNum);
    const ownerIdForWine = cellarOwnerId || user.id;

    // Check for existing matching wine in the same cellar
    // Only reuse wines that belong to the same cellar to ensure they appear correctly
    const matchingWine = await findMatchingWine(
      authenticatedSupabase,
      wineData.name as string,
      wineData.vintage as number | undefined,
      wineData.region as string | undefined,
      wineData.country as string | undefined,
      cellarId || null
    );

    if (matchingWine) {
      // Reuse existing wine - just create/update user_wines link
      // First check if user already has this wine
      const { data: existingLink } = await authenticatedSupabase
        .from("user_wines")
        .select("id, quantity")
        .eq("user_id", ownerIdForWine)
        .eq("wine_id", matchingWine.id)
        .single();

      if (existingLink) {
        // Update quantity (add to existing)
        const { error: updateError } = await authenticatedSupabase
          .from("user_wines")
          .update({ quantity: existingLink.quantity + quantity })
          .eq("id", existingLink.id);

        if (updateError) {
          logApiError("Update user_wines quantity", updateError);
          return errorResponse(`Failed to update wine quantity: ${updateError.message}`, 500);
        }
      } else {
        // Create new link
        const { error: linkError } = await authenticatedSupabase
          .from("user_wines")
          .insert({
            user_id: ownerIdForWine,
            wine_id: matchingWine.id,
            quantity,
          });

        if (linkError) {
          logApiError("Link existing wine to user", linkError);
          return errorResponse(`Failed to link wine: ${linkError.message}`, 500);
        }
      }

      return successResponse({
        success: true,
        wine: { ...matchingWine, quantity: existingLink ? existingLink.quantity + quantity : quantity },
        reused: true // Flag to indicate wine was reused from catalog
      });
    }

    // No match found - create new wine entry
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
        label_image_url: finalLabelImageUrl,
        user_uploaded_label_url: userUploadedLabelUrl || null,
        notes: wineData.notes || null,
        cellar_id: cellarId || null,
      })
      .select()
      .single();

    if (wineError) {
      logApiError("Insert wine", wineError);
      return errorResponse(`Database error: ${wineError.message}`, 500);
    }

    // Link wine to cellar owner via user_wines (for quantity tracking)
    // If adding to a shared cellar, use the cellar owner's ID; otherwise use current user
    const { error: linkError } = await authenticatedSupabase
      .from("user_wines")
      .insert({
        user_id: ownerIdForWine,
        wine_id: wine.id,
        quantity,
      });

    if (linkError) {
      // Cleanup on failure
      await authenticatedSupabase.from("wines").delete().eq("id", wine.id);
      logApiError("Link wine to user", linkError);
      return errorResponse(`Failed to link wine: ${linkError.message}`, 500);
    }

    return successResponse({ success: true, wine: { ...wine, quantity } });
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

    // Get the wine and its cellar
    const { data: wine, error: wineError } = await authenticatedSupabase
      .from("wines")
      .select("cellar_id")
      .eq("id", wineId)
      .single();

    if (wineError || !wine) {
      return errorResponse("Wine not found", 404);
    }

    // Verify user is a member of this cellar and has edit permissions
    const { data: membership, error: membershipError } = await authenticatedSupabase
      .from("cellar_members")
      .select("role")
      .eq("cellar_id", wine.cellar_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return errorResponse("You don't have access to this wine", 403);
    }

    // Only owner and admin can edit wines
    // Members have read-only access
    if (membership.role !== "owner" && membership.role !== "admin") {
      return errorResponse("You don't have permission to edit this wine. Members have read-only access.", 403);
    }

    // Get the cellar owner for quantity updates
    const { data: cellar } = await authenticatedSupabase
      .from("cellars")
      .select("owner_id")
      .eq("id", wine.cellar_id)
      .single();

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

    // Update quantity in the OWNER's user_wines record
    if (quantity !== undefined && cellar?.owner_id) {
      const quantityNum = typeof quantity === "number" ? quantity :
        (typeof quantity === "string" ? parseInt(quantity, 10) : 0);
      const validQuantity = isNaN(quantityNum) ? 0 : quantityNum;
      await authenticatedSupabase
        .from("user_wines")
        .update({ quantity: Math.max(0, validQuantity) })
        .eq("user_id", cellar.owner_id)
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

    // Get the wine and its cellar
    const { data: wine, error: wineError } = await authenticatedSupabase
      .from("wines")
      .select("cellar_id")
      .eq("id", wineId)
      .single();

    if (wineError || !wine) {
      return errorResponse("Wine not found", 404);
    }

    // Handle wines with and without cellar_id
    if (wine.cellar_id) {
      // Wine belongs to a cellar - check if user is the owner
      const { data: cellar, error: cellarError } = await authenticatedSupabase
        .from("cellars")
        .select("owner_id")
        .eq("id", wine.cellar_id)
        .single();

      if (cellarError || !cellar) {
        return errorResponse("Cellar not found", 404);
      }

      // Only the cellar owner can delete wines
      if (cellar.owner_id !== user.id) {
        return errorResponse("Only the cellar owner can delete wines", 403);
      }

      // Delete from user_wines (owner's record)
      const { error } = await authenticatedSupabase
        .from("user_wines")
        .delete()
        .eq("user_id", cellar.owner_id)
        .eq("wine_id", wineId);

      if (error) {
        logApiError("Delete wine from cellar", error);
        throw error;
      }
    } else {
      // Legacy wine without cellar - check if user owns it via user_wines
      const { data: userWine, error: userWineError } = await authenticatedSupabase
        .from("user_wines")
        .select("user_id")
        .eq("wine_id", wineId)
        .eq("user_id", user.id)
        .single();

      if (userWineError || !userWine) {
        return errorResponse("You don't have permission to delete this wine", 403);
      }

      // Delete from user_wines (user's record)
      const { error } = await authenticatedSupabase
        .from("user_wines")
        .delete()
        .eq("user_id", user.id)
        .eq("wine_id", wineId);

      if (error) {
        logApiError("Delete legacy wine", error);
        throw error;
      }
    }

    return successResponse({ success: true });
  } catch (error) {
    logApiError("DELETE /api/wines", error);
    return errorResponse("Failed to delete wine");
  }
}

// ============ Helper Functions ============

/**
 * Find a matching wine in the wines catalog within the same cellar
 * Only matches wines that belong to the same cellar to ensure they appear correctly
 * Uses the same logic as the mobile app's add_user_wine RPC function:
 * 1. First tries exact name match with matching vintage/region/country
 * 2. If no exact match, tries fuzzy matching with 70% similarity threshold
 */
async function findMatchingWine(
  supabase: ReturnType<typeof import("@/lib/supabaseServer").createAuthenticatedClient>,
  name: string,
  vintage?: number | null,
  region?: string | null,
  country?: string | null,
  cellarId?: string | null
): Promise<{
  id: string;
  name: string;
  type?: string;
  grape?: string;
  grapes?: string[];
  is_blend?: boolean;
  region?: string;
  country?: string;
  vintage?: number;
  score?: number | null;
  label_image_url?: string;
  notes?: string;
  cellar_id?: string | null;
} | null> {
  const normalizedName = name.toLowerCase().trim();

  // Build query - filter by cellar_id to only match wines in the same cellar
  let query = supabase
    .from("wines")
    .select("id, name, type, grape, grapes, is_blend, region, country, vintage, score, label_image_url, notes, cellar_id");

  // Only match wines in the same cellar
  if (cellarId) {
    query = query.eq("cellar_id", cellarId);
  } else {
    query = query.is("cellar_id", null);
  }

  const { data: wines, error } = await query;

  if (error || !wines || wines.length === 0) {
    return null;
  }

  // First pass: exact name match with matching attributes
  for (const wine of wines) {
    const existingName = (wine.name || "").toLowerCase().trim();
    if (existingName !== normalizedName) continue;

    // If both have vintages, they must match exactly
    if (vintage && wine.vintage && vintage !== wine.vintage) continue;
    // If both have regions, they should match (case-insensitive)
    if (region && wine.region && region.toLowerCase().trim() !== wine.region.toLowerCase().trim()) continue;
    // If both have countries, they should match (case-insensitive)
    if (country && wine.country && country.toLowerCase().trim() !== wine.country.toLowerCase().trim()) continue;

    return wine;
  }

  // Second pass: fuzzy name match (70% similarity)
  for (const wine of wines) {
    const existingName = (wine.name || "").toLowerCase().trim();

    // Check contains match
    const containsMatch = existingName.includes(normalizedName) || normalizedName.includes(existingName);
    if (!containsMatch) continue;

    // Calculate similarity (shorter name length / longer name length)
    const longer = existingName.length > normalizedName.length ? existingName : normalizedName;
    const shorter = existingName.length > normalizedName.length ? normalizedName : existingName;
    const similarity = shorter.length / longer.length;
    if (similarity < 0.7) continue;

    // If both have vintages, they must match
    if (vintage && wine.vintage && vintage !== wine.vintage) continue;

    return wine;
  }

  return null;
}

/**
 * Filter wines to only include those from cellars where user is owner (not admin).
 * Wines without a cellar (pre-shared-cellars legacy rows) are excluded: they don't
 * appear in any cellar, so they must not count toward stats or search.
 */
async function filterWinesByOwnership(
  supabase: ReturnType<typeof import("@/lib/supabaseServer").createAuthenticatedClient>,
  userId: string,
  wines: any[] | null
): Promise<any[]> {
  if (!wines || wines.length === 0) return [];

  // Get all unique cellar IDs from the wines
  const cellarIds = new Set(
    wines
      .map((uw: any) => uw.wines?.cellar_id)
      .filter((id: string | null | undefined) => id)
  );

  if (cellarIds.size === 0) {
    return [];
  }

  // Get cellars where user is owner
  const { data: ownedCellars } = await supabase
    .from("cellars")
    .select("id")
    .eq("owner_id", userId)
    .in("id", Array.from(cellarIds));

  const ownedCellarIds = new Set(ownedCellars?.map((c: any) => c.id) || []);

  return wines.filter((uw: any) => {
    const cellarId = uw.wines?.cellar_id;
    return !!cellarId && ownedCellarIds.has(cellarId);
  });
}

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
      user_uploaded_label_url: uw.wines.user_uploaded_label_url,
      notes: uw.wines.notes,
      cellar_id: uw.wines.cellar_id,
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
