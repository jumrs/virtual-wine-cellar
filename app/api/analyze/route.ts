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
              text: `Analyze this wine label image and extract the following information in JSON format:
{
  "name": "wine name",
  "grape": "grape varietal if visible",
  "region": "region/appellation if visible",
  "vintage": year as number if visible,
  "notes": "any additional relevant information"
}

Be as accurate as possible. If information is not visible, omit that field. Return only valid JSON.`,
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
      max_tokens: 500,
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
        grape: content.match(/"grape":\s*"([^"]+)"/)?.[1],
        region: content.match(/"region":\s*"([^"]+)"/)?.[1],
        vintage: parseInt(content.match(/"vintage":\s*(\d+)/)?.[1] || "0") || undefined,
        notes: content.match(/"notes":\s*"([^"]+)"/)?.[1],
      };
    }

    // Ensure name is present
    if (!wineData.name) {
      wineData.name = "Unknown Wine";
    }

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

