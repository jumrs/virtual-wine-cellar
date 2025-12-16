import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openaiClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";
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
    const rateLimit = checkRateLimit(`pair:${clientId}`, RATE_LIMITS.ai);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.` },
        { 
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Authentication via header (more secure than body)
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate body (support both old and new format for backward compatibility)
    const body = await request.json();
    const meal = body.meal;

    if (!meal || typeof meal !== "string") {
      return NextResponse.json(
        { error: "Meal description is required" },
        { status: 400 }
      );
    }

    // Sanitize user input
    const sanitizedMeal = sanitizeTextInput(meal);
    if (!sanitizedMeal || sanitizedMeal.length < 2) {
      return NextResponse.json(
        { error: "Please provide a valid meal description" },
        { status: 400 }
      );
    }

    if (sanitizedMeal.length > 500) {
      return NextResponse.json(
        { error: "Meal description is too long (max 500 characters)" },
        { status: 400 }
      );
    }

    // Create authenticated client
    const authenticatedSupabase = createAuthenticatedClient(accessToken);

    // Fetch user's wines
    const { data: wines, error: winesError } = await authenticatedSupabase
      .from("user_wines")
      .select(`
        wines (
          id,
          name,
          grape,
          region,
          vintage
        )
      `)
      .eq("user_id", user.id);

    if (winesError) {
      console.error("Error fetching wines:", winesError);
    }

    const userWines = wines?.map((uw: any) => uw.wines).filter(Boolean) || [];

    if (userWines.length === 0) {
      return NextResponse.json({
        suggestion: "You don't have any wines in your cellar yet. Add some wines first to get pairing suggestions!",
      });
    }

    // Format wines for GPT
    const winesList = userWines
      .map((wine: any) => {
        const parts = [wine.name];
        if (wine.grape) parts.push(`(${wine.grape})`);
        if (wine.region) parts.push(`from ${wine.region}`);
        if (wine.vintage) parts.push(`${wine.vintage}`);
        return parts.join(" ");
      })
      .join(", ");

    // Use GPT to suggest pairings
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a wine pairing expert. Analyze the user's meal and suggest 1-3 wines from their cellar that would pair well. Be specific about why each wine pairs well with the meal.`,
        },
        {
          role: "user",
          content: `I'm having: ${sanitizedMeal}\n\nMy available wines: ${winesList}\n\nSuggest the best pairings from my cellar with brief reasoning.`,
        },
      ],
      max_tokens: 500,
    });

    const suggestion = response.choices[0]?.message?.content || "I couldn't generate a pairing suggestion.";

    return NextResponse.json({ suggestion });
  } catch (error: unknown) {
    // Log error securely (only in development)
    if (process.env.NODE_ENV === "development") {
      console.error("Error generating pairing suggestion:", error);
    }
    
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

