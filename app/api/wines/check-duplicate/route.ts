import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  sanitizeTextInput,
  sanitizeErrorMessage,
} from "@/lib/security";

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

    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const authenticatedSupabase = createAuthenticatedClient(accessToken);

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { name, vintage, region, country } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Wine name is required" },
        { status: 400 }
      );
    }

    // Sanitize and normalize the wine name for comparison
    const sanitizedName = sanitizeTextInput(name);
    const normalizedName = sanitizedName.toLowerCase().trim();

    // Fetch user's wines
    const { data: userWines, error: fetchError } = await authenticatedSupabase
      .from("user_wines")
      .select(`
        id,
        quantity,
        wines (
          id,
          name,
          type,
          grape,
          region,
          country,
          vintage,
          score,
          label_image_url
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

    // Check for potential duplicates
    const potentialDuplicates = userWines?.filter((uw: any) => {
      const wine = uw.wines;
      if (!wine) return false;

      // Normalize existing wine name
      const existingName = wine.name?.toLowerCase().trim() || "";

      // Check if names match (exact match or one contains the other)
      // This handles cases like "Château Latour" vs "Chateau Latour" or partial matches
      const exactMatch = existingName === normalizedName;
      const containsMatch = existingName.includes(normalizedName) || normalizedName.includes(existingName);
      
      // For contains match, ensure the shorter name is at least 70% of the longer name
      // This prevents false positives from very short names
      let nameMatch = exactMatch;
      if (!exactMatch && containsMatch) {
        const longer = existingName.length > normalizedName.length ? existingName : normalizedName;
        const shorter = existingName.length > normalizedName.length ? normalizedName : existingName;
        const similarity = shorter.length / longer.length;
        nameMatch = similarity >= 0.7; // At least 70% similarity
      }

      if (!nameMatch) return false;

      // If both have vintages, they should match for a duplicate
      if (vintage && wine.vintage) {
        if (vintage !== wine.vintage) {
          // Names match but vintages differ - likely different wines
          return false;
        }
      }

      // If both have regions, they should match for a duplicate
      if (region && wine.region) {
        const existingRegion = wine.region.toLowerCase().trim();
        const newRegion = region.toLowerCase().trim();
        if (existingRegion !== newRegion) {
          // Names match but regions differ - might be different wines
          // Still consider it a potential duplicate but with lower confidence
        }
      }

      // If both have countries, they should match for a duplicate
      if (country && wine.country) {
        const existingCountry = wine.country.toLowerCase().trim();
        const newCountry = country.toLowerCase().trim();
        if (existingCountry !== newCountry) {
          // Names match but countries differ - might be different wines
        }
      }

      return true;
    }) || [];

    if (potentialDuplicates.length > 0) {
      // Format duplicate wines for display
      const duplicates = potentialDuplicates.map((uw: any) => ({
        id: uw.wines.id,
        name: uw.wines.name,
        type: uw.wines.type,
        vintage: uw.wines.vintage,
        region: uw.wines.region,
        country: uw.wines.country,
        quantity: uw.quantity || 0,
        score: uw.wines.score,
        label_image_url: uw.wines.label_image_url,
      }));

      return NextResponse.json({
        isDuplicate: true,
        duplicates,
      });
    }

    return NextResponse.json({
      isDuplicate: false,
      duplicates: [],
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

