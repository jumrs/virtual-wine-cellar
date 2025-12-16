import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  isValidUUID,
  sanitizeErrorMessage,
} from "@/lib/security";

// PATCH: Update wine quantity
export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:quantity:${clientId}`, RATE_LIMITS.standard);
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { wineId, quantity } = body;

    if (!wineId || quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: "Wine ID and quantity are required" },
        { status: 400 }
      );
    }

    // Validate wine ID format
    if (!isValidUUID(wineId)) {
      return NextResponse.json(
        { error: "Invalid wine ID format" },
        { status: 400 }
      );
    }

    // Validate quantity as a number
    const quantityNum = parseInt(String(quantity), 10);
    if (isNaN(quantityNum) || quantityNum < 0 || quantityNum > 10000) {
      return NextResponse.json(
        { error: "Quantity must be a valid number between 0 and 10000" },
        { status: 400 }
      );
    }

    const authenticatedSupabase = createAuthenticatedClient(accessToken);

    // Verify user owns this wine
    const { data: userWine, error: checkError } = await authenticatedSupabase
      .from("user_wines")
      .select("id")
      .eq("user_id", user.id)
      .eq("wine_id", wineId)
      .single();

    if (checkError || !userWine) {
      return NextResponse.json(
        { error: "Wine not found or you don't have permission to edit it" },
        { status: 404 }
      );
    }

    // Update quantity in user_wines (allow 0)
    const { error: quantityError } = await authenticatedSupabase
      .from("user_wines")
      .update({
        quantity: quantityNum,
      })
      .eq("user_id", user.id)
      .eq("wine_id", wineId);

    if (quantityError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating quantity:", quantityError);
      }
      return NextResponse.json(
        { error: "Failed to update quantity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, quantity: quantityNum });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error updating quantity:", error);
    }
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}



