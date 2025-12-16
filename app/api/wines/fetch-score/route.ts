import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openaiClient";
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
    const rateLimit = checkRateLimit(`fetch-score:${clientId}`, RATE_LIMITS.ai);
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

    // Authentication check
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, grape, region, country, vintage } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Wine name is required" },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedName = sanitizeTextInput(name);
    const sanitizedType = sanitizeTextInput(type);
    const sanitizedGrape = sanitizeTextInput(grape);
    const sanitizedRegion = sanitizeTextInput(region);
    const sanitizedCountry = sanitizeTextInput(country);

    // Build a comprehensive search query for the wine using sanitized inputs
    let wineQuery = sanitizedName;
    if (sanitizedType) wineQuery += ` ${sanitizedType}`;
    if (sanitizedGrape) wineQuery += ` ${sanitizedGrape}`;
    if (sanitizedRegion) wineQuery += ` ${sanitizedRegion}`;
    if (sanitizedCountry) wineQuery += ` ${sanitizedCountry}`;
    if (vintage) wineQuery += ` ${vintage}`;

    // Use OpenAI to search for wine scores from the x-wines dataset and other wine databases
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert wine database researcher specializing in wine scoring systems.

Your task is to find the wine score for a given wine by searching through Vivino, primarily. If the wine is not found in Vivino, search other wine community platforms.

Return ONLY a valid JSON object with the following structure:
{
  "score": <number between 0 and 5, or null if not found>,
  "source": "<brief description of where the score came from, e.g., 'X-Wines dataset', 'Wine Spectator', 'Vivino average', etc.>",
}

Rules:
- The score must be on a 0-5 scale. If you find scores on other scales (e.g., 0-100, 0-20), convert them to 0-5 scale.
- If the wine cannot be found in any database, return score: null.
- Be precise and only return scores you can reasonably verify.
- Do NOT include explanations outside the JSON.
- Do NOT output anything outside the JSON object.`,
        },
        {
          role: "user",
          content: `Find the wine score for: ${wineQuery}

Please search Vivino to find the score for this wine. If multiple scores exist, use the most authoritative or recent one.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse JSON response
    let scoreData;
    try {
      scoreData = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parsing score response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse score data from OpenAI" },
        { status: 500 }
      );
    }

    // Validate and normalize the score
    let score: number | null = null;
    if (scoreData.score !== null && scoreData.score !== undefined) {
      const parsedScore = parseFloat(scoreData.score);
      if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 5) {
        score = Math.round(parsedScore * 10) / 10; // Round to 1 decimal place
      }
    }

    return NextResponse.json({
      score,
      source: scoreData.source || "Unknown",
      confidence: scoreData.confidence || "low",
      notes: scoreData.notes || null,
    });
  } catch (error: unknown) {
    // Log error securely (only in development)
    if (process.env.NODE_ENV === "development") {
      console.error("Error fetching wine score:", error);
    }
    
    // Return sanitized error message
    const errorMessage = sanitizeErrorMessage(error);
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}



