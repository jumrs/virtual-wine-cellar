import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET: Search for wine images from the internet
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const wineName = searchParams.get("wineName") || "";

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }
    
      // Fallback: Use a simple image search API or return placeholder
      // For now, we'll use Pexels API as an alternative (free tier available)
      const pexelsApiKey = process.env.PEXELS_API_KEY;
      
      if (pexelsApiKey) {
        const searchTerm = `${wineName} ${query} wine bottle label`.trim();
        const pexelsResponse = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=9`,
          {
            headers: {
              Authorization: pexelsApiKey,
            },
          }
        );

        if (pexelsResponse.ok) {
          const pexelsData = await pexelsResponse.json();
          const urls = pexelsData.photos?.map((photo: any) => photo.src.large) || [];
          return NextResponse.json({ urls });
        }
      }

      // If no API keys are available, try using a simple fallback
      // We can use a placeholder service or return empty results with a message
      console.warn("No image search API key configured. Image search will not work.");
      return NextResponse.json(
        { 
          error: "Image search is not configured. Please set PEXELS_API_KEY or UNSPLASH_ACCESS_KEY in your environment variables to enable image search.",
          urls: []
        },
        { status: 503 }
      );


    // Use Unsplash API
    const searchTerm = `${wineName} ${query} wine bottle label`.trim();
    const unsplashResponse = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=9&orientation=portrait`,
      {
        headers: {
          Authorization: `Client-ID ${unsplashAccessKey}`,
        },
      }
    );

    if (!unsplashResponse.ok) {
      throw new Error(`Unsplash API error: ${unsplashResponse.statusText}`);
    }

    const unsplashData = await unsplashResponse.json();
    const urls = unsplashData.results?.map((photo: any) => photo.urls.regular) || [];

    return NextResponse.json({ urls });
  } catch (error: any) {
    console.error("Error searching for images:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search for images", urls: [] },
      { status: 500 }
    );
  }
}

