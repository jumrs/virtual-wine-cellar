import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openaiClient";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);
    // Convert to base64 in chunks to avoid stack overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binary);
    const mimeType = file.type;

    // Use OpenAI Vision API to analyze the wine label
const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert wine-label analyzer and wine-data researcher.
  
  Your task:
  1. Analyze the provided wine-label image.
  2. Extract all visible information.
  3. For any field that is missing, unclear, or not visible, search the internet using the detected wine name and producer.
  4. Verify information with reputable sources (producer website, major wine retailers, wine databases).
  5. Search for tasting notes, flavor profiles, and additional wine information from reputable sources.
  6. If a field cannot be verified, return null instead of guessing.
  7. IMPORTANT: For grape varieties, return an ARRAY of all grape varietals. If it's a blend, include ALL grapes in the blend.
  
  Return ONLY valid JSON with the following structure:
  
  {
    "name": "wine name",
    "type": "wine type if visible or found online (e.g. red, white, rosé, sparkling, etc.)",
    "grapes": ["array", "of", "grape", "varietals"] or empty array if unknown,
    "is_blend": true if multiple grapes, false if single grape or unknown,
    "region": "region/appellation if visible or found online (e.g. Bordeaux, Napa Valley)",
    "country": "country if visible or found online (e.g. France, Italy, USA)",
    "vintage": year as number or null,
    "notes": "Include any tasting notes, flavor profiles, producer information, cuvée details, classification, label details, and any other relevant additional information found from reputable sources. Combine all this information into a comprehensive notes field."
  }
  
  Rules:
  - Do NOT include explanations.
  - Do NOT output anything outside the JSON.
  - Do NOT write words starting with lowercase letters.
  - Prioritize information that is visible on the label before online results.
  - If conflicting online sources appear, choose the most authoritative one.
  - For the notes field, include tasting notes, flavor profiles, and any other relevant wine information you find.
  - CRITICAL: "grapes" MUST be an array, even for single grape wines (e.g. ["Pinot Noir"]).
  - If the wine is a blend (e.g., Bordeaux blend, Rhône blend), list all component grapes.
  - Common blends to recognize: Bordeaux (Cabernet Sauvignon, Merlot, Cabernet Franc, Petit Verdot, Malbec), GSM (Grenache, Syrah, Mourvèdre), Champagne (Chardonnay, Pinot Noir, Pinot Meunier).`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 600,
  });
  

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse JSON response
    let wineData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      wineData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      // If parsing fails, try to extract fields manually
      wineData = {
        name: content.match(/"name":\s*"([^"]+)"/)?.[1] || "Unknown Wine",
        type: content.match(/"type":\s*"([^"]+)"/)?.[1],
        grapes: [],
        is_blend: false,
        region: content.match(/"region":\s*"([^"]+)"/)?.[1],
        country: content.match(/"country":\s*"([^"]+)"/)?.[1],
        vintage: parseInt(content.match(/"vintage":\s*(\d+)/)?.[1] || "0") || undefined,
        notes: content.match(/"notes":\s*"([^"]+)"/)?.[1],
      };
    }

    // Ensure name is present
    if (!wineData.name) {
      wineData.name = "Unknown Wine";
    }

    // Normalize grapes field - ensure it's always an array
    if (wineData.grapes && !Array.isArray(wineData.grapes)) {
      // If grapes is a string, convert to array
      if (typeof wineData.grapes === 'string') {
        wineData.grapes = wineData.grapes.split(/[\/,+]|\s+and\s+/i).map((g: string) => g.trim()).filter((g: string) => g);
      } else {
        wineData.grapes = [];
      }
    }
    
    // Ensure grapes is at least an empty array
    if (!wineData.grapes) {
      wineData.grapes = [];
    }

    // Handle legacy "grape" field if present and grapes array is empty
    if (wineData.grape && wineData.grapes.length === 0) {
      wineData.grapes = wineData.grape.split(/[\/,+]|\s+and\s+/i).map((g: string) => g.trim()).filter((g: string) => g);
    }

    // Set is_blend based on grapes array length
    wineData.is_blend = wineData.grapes.length > 1;

    // Also set legacy grape field for backward compatibility
    wineData.grape = wineData.grapes.length > 0 ? wineData.grapes.join(", ") : null;

    return NextResponse.json(wineData);
  } catch (error: any) {
    console.error("Error analyzing wine label:", error);
    
    // Provide more specific error messages
    let errorMessage = "Failed to analyze wine label";
    if (error.message?.includes("API key")) {
      errorMessage = "OpenAI API key is invalid or missing";
    } else if (error.message?.includes("rate limit")) {
      errorMessage = "OpenAI API rate limit exceeded. Please try again later.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

