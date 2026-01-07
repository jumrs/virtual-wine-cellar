/**
 * Wine Label Scanning API
 * 
 * Analyzes wine label photos using AI to:
 * 1. Identify wine details (name, producer, region, vintage)
 * 2. Search for a standardized bottle image from public sources
 * 3. Return enriched wine data with confidence scores
 */

import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openaiClient";
import { supabase } from "@/lib/supabaseClient";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  validateImageFile,
  sanitizeErrorMessage,
  sanitizeTextInput,
} from "@/lib/security";

/** Response structure from the AI wine identification */
interface WineIdentificationResult {
  name: string;
  producer?: string;
  type?: string;
  grapes: string[];
  is_blend: boolean;
  region?: string;
  country?: string;
  vintage?: number | null;
  notes?: string;
  confidence: number;
  search_terms?: string;
}

/** Final response structure */
interface ScanWineResponse extends WineIdentificationResult {
  standard_image_url: string | null;
  grape?: string; // Legacy field for backward compatibility
}

/**
 * Validate if a URL is a valid image URL
 */
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  
  try {
    const parsed = new URL(url);
    
    // Must be HTTPS
    if (parsed.protocol !== "https:") return false;
    
    // Block known proprietary platforms per user requirements
    const blockedDomains = [
      "vivino.com",
      "wine.com",
    ];
    
    const isBlocked = blockedDomains.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
    
    if (isBlocked) return false;
    
    // Allow any HTTPS URL that looks like it could be an image
    return true;
  } catch {
    return false;
  }
}

/**
 * Search for the actual wine bottle image using web image search APIs
 * This searches the real web to find product images of the specific wine
 */
async function searchWineImage(
  wineName: string,
  producer?: string,
  region?: string,
  vintage?: number | null
): Promise<string | null> {
  // Build a specific search query for this wine
  const searchParts: string[] = [];
  if (producer) searchParts.push(producer);
  searchParts.push(wineName);
  if (vintage) searchParts.push(String(vintage));
  searchParts.push("wine bottle");
  
  const searchQuery = searchParts.join(" ");
  
  // Domains to exclude from results (proprietary platforms)
  const excludedDomains = ["vivino.com", "wine.com"];
  
  // Try Google Custom Search API first (best for finding specific product images)
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (googleApiKey && googleSearchEngineId) {
    try {
      const params = new URLSearchParams({
        key: googleApiKey,
        cx: googleSearchEngineId,
        q: searchQuery,
        searchType: "image",
        num: "5", // Get a few results to filter
        imgSize: "large",
        imgType: "photo",
        safe: "active",
      });
      
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params.toString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Find the first valid image not from excluded domains
        for (const item of data.items || []) {
          const imageUrl = item.link;
          if (imageUrl && isValidImageUrl(imageUrl)) {
            const isExcluded = excludedDomains.some(domain => 
              imageUrl.toLowerCase().includes(domain)
            );
            if (!isExcluded) {
              return imageUrl;
            }
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Google Image Search error:", error);
      }
    }
  }
  
  // Try Bing Image Search API as fallback
  const bingApiKey = process.env.BING_SEARCH_API_KEY;
  
  if (bingApiKey) {
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        count: "5",
        imageType: "Photo",
        size: "Large",
        safeSearch: "Moderate",
      });
      
      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/images/search?${params.toString()}`,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": bingApiKey,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Find the first valid image not from excluded domains
        for (const item of data.value || []) {
          const imageUrl = item.contentUrl;
          if (imageUrl && isValidImageUrl(imageUrl)) {
            const isExcluded = excludedDomains.some(domain => 
              imageUrl.toLowerCase().includes(domain)
            );
            if (!isExcluded) {
              return imageUrl;
            }
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Bing Image Search error:", error);
      }
    }
  }
  
  // Try SerpAPI as another fallback (Google search scraping service)
  const serpApiKey = process.env.SERPAPI_KEY;
  
  if (serpApiKey) {
    try {
      const params = new URLSearchParams({
        api_key: serpApiKey,
        engine: "google_images",
        q: searchQuery,
        num: "5",
        safe: "active",
      });
      
      const response = await fetch(
        `https://serpapi.com/search.json?${params.toString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Find the first valid image not from excluded domains
        for (const item of data.images_results || []) {
          const imageUrl = item.original;
          if (imageUrl && isValidImageUrl(imageUrl)) {
            const isExcluded = excludedDomains.some(domain => 
              imageUrl.toLowerCase().includes(domain)
            );
            if (!isExcluded) {
              return imageUrl;
            }
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("SerpAPI Image Search error:", error);
      }
    }
  }
  
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "No web image search API configured. Set one of: GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID, BING_SEARCH_API_KEY, or SERPAPI_KEY"
    );
  }
  
  return null;
}

/**
 * POST /api/scanWine
 * 
 * Accepts an uploaded wine label photo and returns enriched wine data
 * including a standardized bottle image URL.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`scanWine:${clientId}`, RATE_LIMITS.ai);
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

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Validate file
    const fileValidation = validateImageFile(file, 10);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binary);
    const mimeType = file.type;

    // Enhanced system prompt for wine identification with image search terms
    const systemPrompt = `You are an expert AI wine identifier and sommelier.

The user provides a photo of a wine label. Your task is to:

1. Analyze the wine label image carefully
2. Identify the wine as precisely as possible (name, vintage, producer, region)
3. Extract all visible information from the label
4. For any field that is missing or unclear, use your knowledge to fill in accurate information
5. Provide search terms that would help find a high-quality standardized bottle image of this wine. Prioritize images with white/clear backgrounds.

IMPORTANT GUIDELINES:
- Prioritize information visible on the label
- Use your wine knowledge to verify and enrich the data
- Do NOT reference or use data from Vivino, Wine.com, or other proprietary wine platforms
- For search_terms, provide specific terms that would find a high-quality standardized bottle photo. Prioritize images with white/clear backgrounds.
- If the wine cannot be identified with reasonable confidence, still extract what you can see

Return ONLY valid JSON with this exact structure:

{
  "name": "Full wine name as it should appear",
  "producer": "Winery/producer name",
  "type": "Red|White|Rosé|Sparkling|Dessert|Fortified|Orange",
  "grapes": ["Array", "of", "grape", "varieties"],
  "is_blend": true or false,
  "region": "Wine region/appellation",
  "country": "Country of origin",
  "vintage": year as number or null if non-vintage,
  "notes": "Include any tasting notes, flavor profiles, producer information, cuvée details, classification, label details, and any other relevant additional information found from reputable sources. Combine all this information into a comprehensive notes field.",
  "search_terms": "optimized search query for finding high-quality, standardized, professional bottle image. Prioritize images with white/clear backgrounds."
}

Rules:
- Do NOT include explanations outside the JSON
- "grapes" MUST be an array, even for single varietals
- Set is_blend to true if grapes.length > 1
- search_terms should include producer, wine name, vintage, and "bottle" or "wine bottle"`;

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this wine label and provide the wine information as structured JSON.",
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
      max_tokens: 800,
      temperature: 0.3, // Lower temperature for more consistent identification
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse JSON response
    let wineData: WineIdentificationResult;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      wineData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      // If parsing fails, try to extract fields manually
      wineData = {
        name: content.match(/"name":\s*"([^"]+)"/)?.[1] || "Unknown Wine",
        producer: content.match(/"producer":\s*"([^"]+)"/)?.[1],
        type: content.match(/"type":\s*"([^"]+)"/)?.[1],
        grapes: [],
        is_blend: false,
        region: content.match(/"region":\s*"([^"]+)"/)?.[1],
        country: content.match(/"country":\s*"([^"]+)"/)?.[1],
        vintage: parseInt(content.match(/"vintage":\s*(\d+)/)?.[1] || "0") || null,
        notes: content.match(/"notes":\s*"([^"]+)"/)?.[1],
        confidence: 0.5,
        search_terms: content.match(/"search_terms":\s*"([^"]+)"/)?.[1],
      };
    }

    // Ensure required fields
    if (!wineData.name) {
      wineData.name = "Unknown Wine";
    }

    // Normalize grapes field
    if (wineData.grapes && !Array.isArray(wineData.grapes)) {
      if (typeof wineData.grapes === "string") {
        wineData.grapes = (wineData.grapes as string)
          .split(/[\/,+]|\s+and\s+/i)
          .map((g: string) => g.trim())
          .filter((g: string) => g);
      } else {
        wineData.grapes = [];
      }
    }
    
    if (!wineData.grapes) {
      wineData.grapes = [];
    }

    // Set is_blend based on grapes array length
    wineData.is_blend = wineData.grapes.length > 1;

    // Ensure confidence is a valid number
    if (typeof wineData.confidence !== "number" || isNaN(wineData.confidence)) {
      wineData.confidence = 0.5;
    }
    wineData.confidence = Math.max(0, Math.min(1, wineData.confidence));

    // Search for standardized bottle image
    let standardImageUrl: string | null = null;
    
    // Use AI-generated search terms if available, otherwise build from wine data
    const searchTerms = wineData.search_terms || 
      `${wineData.producer || ""} ${wineData.name} ${wineData.vintage || ""} wine bottle`.trim();
    
    // Sanitize search terms
    const sanitizedSearchTerms = sanitizeTextInput(searchTerms);
    
    if (sanitizedSearchTerms && sanitizedSearchTerms.length > 3) {
      standardImageUrl = await searchWineImage(
        wineData.name,
        wineData.producer,
        wineData.region,
        wineData.vintage
      );
    }

    // Build final response
    const result: ScanWineResponse = {
      ...wineData,
      standard_image_url: standardImageUrl,
      // Legacy field for backward compatibility
      grape: wineData.grapes.length > 0 ? wineData.grapes.join(", ") : undefined,
    };

    // Remove search_terms from response (internal use only)
    delete (result as any).search_terms;

    return NextResponse.json(result);
  } catch (error: unknown) {
    // Log error securely
    if (process.env.NODE_ENV === "development") {
      console.error("Error scanning wine label:", error);
    }

    // Return sanitized error message
    const errorMessage = sanitizeErrorMessage(error);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

