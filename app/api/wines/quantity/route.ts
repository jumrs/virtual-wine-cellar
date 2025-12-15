import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";

// PATCH: Update wine quantity
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { wineId, quantity } = body;

    if (!wineId || quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: "Wine ID and quantity are required" },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: "Quantity cannot be negative" },
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
        quantity: quantity,
      })
      .eq("user_id", user.id)
      .eq("wine_id", wineId);

    if (quantityError) {
      console.error("Error updating quantity:", quantityError);
      return NextResponse.json(
        { error: `Failed to update quantity: ${quantityError.message || quantityError.code}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, quantity });
  } catch (error: any) {
    console.error("Error updating quantity:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update quantity" },
      { status: 500 }
    );
  }
}



