import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError } from "@/lib/apiUtils";
import { fetchCellarWines } from "@/lib/cellarWines";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  sanitizeTextInput,
  sanitizeErrorMessage,
  isValidUUID,
} from "@/lib/security";

/** Minimal wine shape needed for duplicate matching and display */
interface CandidateWine {
  id: string;
  name: string;
  type?: string;
  vintage?: number;
  region?: string;
  country?: string;
  quantity?: number;
  score?: number | null;
  label_image_url?: string;
}

/**
 * Whether an existing wine is likely the same wine as the one being added.
 * Names must match exactly, or one must contain the other with ≥70% length
 * similarity; if both have vintages, they must match.
 */
function isPotentialDuplicate(
  wine: CandidateWine,
  normalizedName: string,
  vintage?: number
): boolean {
  const existingName = wine.name?.toLowerCase().trim() || "";

  // Check if names match (exact match or one contains the other)
  // This handles cases like "Château Latour" vs "Château Latour Pauillac"
  const exactMatch = existingName === normalizedName;
  const containsMatch = existingName.includes(normalizedName) || normalizedName.includes(existingName);

  // For contains match, ensure the shorter name is at least 70% of the longer name
  // This prevents false positives from very short names
  let nameMatch = exactMatch;
  if (!exactMatch && containsMatch) {
    const longer = existingName.length > normalizedName.length ? existingName : normalizedName;
    const shorter = existingName.length > normalizedName.length ? normalizedName : existingName;
    nameMatch = shorter.length / longer.length >= 0.7;
  }

  if (!nameMatch) return false;

  // Names match but vintages differ - different wines
  if (vintage && wine.vintage && vintage !== wine.vintage) return false;

  // Region/country differences are still reported as potential duplicates;
  // the user confirms in the duplicate dialog.
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:check-duplicate:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;
    const { user, authenticatedSupabase } = auth;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { name, vintage, cellarId } = body ?? {};

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Wine name is required" },
        { status: 400 }
      );
    }

    const normalizedName = sanitizeTextInput(name).toLowerCase();

    let candidates: CandidateWine[];

    if (cellarId) {
      // Cellar-based: compare against every wine in the target cellar,
      // including shared cellars owned by someone else
      if (typeof cellarId !== "string" || !isValidUUID(cellarId)) {
        return NextResponse.json({ error: "Invalid cellar ID format" }, { status: 400 });
      }

      const { data: membership, error: membershipError } = await authenticatedSupabase
        .from("cellar_members")
        .select("id")
        .eq("cellar_id", cellarId)
        .eq("user_id", user.id)
        .single();

      if (membershipError || !membership) {
        return NextResponse.json({ error: "Access denied to this cellar" }, { status: 403 });
      }

      const { data: cellar } = await authenticatedSupabase
        .from("cellars")
        .select("owner_id")
        .eq("id", cellarId)
        .single();

      if (!cellar?.owner_id) {
        return NextResponse.json({ error: "Cellar not found" }, { status: 404 });
      }

      candidates = (await fetchCellarWines(authenticatedSupabase, cellarId, cellar.owner_id)) as CandidateWine[];
    } else {
      // Legacy: no cellar selected, wines are saved against the user without a cellar_id
      const { data: userWines, error: fetchError } = await authenticatedSupabase
        .from("user_wines")
        .select(`
          quantity,
          wines (
            id,
            name,
            type,
            region,
            country,
            vintage,
            score,
            label_image_url,
            cellar_id
          )
        `)
        .eq("user_id", user.id);

      if (fetchError) {
        console.error("Error fetching wines:", fetchError);
        return NextResponse.json(
          { error: "Failed to check for duplicates" },
          { status: 500 }
        );
      }

      candidates = (userWines || [])
        .filter((uw: any) => uw.wines && !uw.wines.cellar_id)
        .map((uw: any) => ({ ...uw.wines, quantity: uw.quantity ?? 1 }));
    }

    const duplicates = candidates
      .filter((wine) => isPotentialDuplicate(wine, normalizedName, vintage))
      .map((wine) => ({
        id: wine.id,
        name: wine.name,
        type: wine.type,
        vintage: wine.vintage,
        region: wine.region,
        country: wine.country,
        quantity: wine.quantity ?? 0,
        score: wine.score,
        label_image_url: wine.label_image_url,
      }));

    return NextResponse.json({
      isDuplicate: duplicates.length > 0,
      duplicates,
    });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in check-duplicate:", error);
    }
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
