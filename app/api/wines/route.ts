import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";

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

    // Create authenticated client
    const authenticatedSupabase = createAuthenticatedClient(accessToken);

    // Fetch user's wines
    // Try to fetch with quantity first, fallback if column doesn't exist
    let wines: any[] | null = null;
    let error: any = null;
    
    // First attempt: try with quantity column
    const { data: winesWithQuantity, error: errorWithQuantity } = await authenticatedSupabase
      .from("user_wines")
      .select(`
        id,
        quantity,
        date_added,
        wines (
          id,
          name,
          type,
          grape,
          region,
          country,
          vintage,
          label_image_url,
          notes
        )
      `)
      .eq("user_id", user.id)
      .order("date_added", { ascending: false });

    // If quantity column doesn't exist, try without it
    if (errorWithQuantity && errorWithQuantity.code === '42703' && errorWithQuantity.message?.includes('quantity')) {
      console.warn("Quantity column doesn't exist, fetching without it. Please run the migration SQL.");
      const { data: winesWithoutQuantity, error: errorWithoutQuantity } = await authenticatedSupabase
        .from("user_wines")
        .select(`
          id,
          date_added,
          wines (
            id,
            name,
            grape,
            region,
            vintage,
            label_image_url,
            notes
          )
        `)
        .eq("user_id", user.id)
        .order("date_added", { ascending: false });
      
      wines = winesWithoutQuantity;
      error = errorWithoutQuantity;
    } else {
      wines = winesWithQuantity;
      error = errorWithQuantity;
    }

    if (error) {
      throw error;
    }

    // Flatten the response
    const formattedWines = wines?.map((uw: any) => ({
      id: uw.wines.id,
      name: uw.wines.name,
      type: uw.wines.type,
      grape: uw.wines.grape,
      region: uw.wines.region,
      country: uw.wines.country,
      vintage: uw.wines.vintage,
      label_image_url: uw.wines.label_image_url,
      notes: uw.wines.notes,
      date_added: uw.date_added,
      quantity: uw.quantity ?? 1, // Default to 1 if quantity doesn't exist
    })) || [];

    return NextResponse.json(formattedWines);
  } catch (error) {
    console.error("Error fetching wines:", error);
    return NextResponse.json(
      { error: "Failed to fetch wines" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: `Unauthorized: ${authError?.message || "Invalid token"}` },
        { status: 401 }
      );
    }

    console.log("Authenticated user:", user.id, user.email);

    const formData = await request.formData();
    const file = formData.get("image") as File;
    const wineDataStr = formData.get("wineData") as string;
    
    if (!wineDataStr) {
      return NextResponse.json(
        { error: "Missing wine data" },
        { status: 400 }
      );
    }
    
    const wineData = JSON.parse(wineDataStr);

    // Create authenticated client (uses service role for server-side operations)
    const authenticatedSupabase = createAuthenticatedClient(accessToken);

    // Upload image to Supabase storage if provided
    let imageUrl: string | undefined;
    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const fileBuffer = await file.arrayBuffer();

      const { data: uploadData, error: uploadError } = await authenticatedSupabase.storage
        .from("wine-labels")
        .upload(fileName, fileBuffer, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        // Don't fail the whole request if image upload fails
        // Just log it and continue without the image URL
        if (uploadError.message.includes("Bucket not found")) {
          console.error("Storage bucket 'wine-labels' does not exist. Please create it in Supabase Storage.");
        }
      } else {
        const { data: urlData } = authenticatedSupabase.storage
          .from("wine-labels")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
    }

    // Insert wine into database
    console.log("Inserting wine with data:", {
      name: wineData.name,
      grape: wineData.grape,
      region: wineData.region,
      vintage: wineData.vintage,
      label_image_url: imageUrl,
      notes: wineData.notes,
    });

    const { data: wine, error: wineError } = await authenticatedSupabase
      .from("wines")
      .insert({
        name: wineData.name,
        type: wineData.type || null,
        grape: wineData.grape || null,
        region: wineData.region || null,
        country: wineData.country || null,
        vintage: wineData.vintage || null,
        label_image_url: imageUrl || null,
        notes: wineData.notes || null,
      })
      .select()
      .single();

    if (wineError) {
      console.error("Error inserting wine:", wineError);
      console.error("Error details:", JSON.stringify(wineError, null, 2));
      return NextResponse.json(
        { error: `Database error: ${wineError.message || wineError.code || "Failed to save wine"}. Details: ${JSON.stringify(wineError)}` },
        { status: 500 }
      );
    }

    console.log("Wine inserted successfully:", wine);

    // Link wine to user with quantity
    const quantity = wineData.quantity && wineData.quantity > 0 ? wineData.quantity : 1;
    console.log("Linking wine to user:", { user_id: user.id, wine_id: wine.id, quantity });
    
    const { error: linkError } = await authenticatedSupabase
      .from("user_wines")
      .insert({
        user_id: user.id,
        wine_id: wine.id,
        quantity: quantity,
      });

    if (linkError) {
      console.error("Error linking wine to user:", linkError);
      console.error("Link error details:", JSON.stringify(linkError, null, 2));
      // Try to clean up the wine if linking fails
      await authenticatedSupabase.from("wines").delete().eq("id", wine.id);
      return NextResponse.json(
        { error: `Failed to link wine to your account: ${linkError.message || linkError.code || "Database error"}. Details: ${JSON.stringify(linkError)}` },
        { status: 500 }
      );
    }

    console.log("Wine linked to user successfully");

    return NextResponse.json({ success: true, wine });
  } catch (error: any) {
    console.error("Error saving wine:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save wine" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: `Unauthorized: ${authError?.message || "Invalid token"}` },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const wineId = searchParams.get("id");

    if (!wineId) {
      return NextResponse.json(
        { error: "Wine ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, type, grape, region, country, vintage, notes, quantity } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Wine name is required" },
        { status: 400 }
      );
    }

    // Create authenticated client
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

    // Update wine information
    const { data: updatedWine, error: wineError } = await authenticatedSupabase
      .from("wines")
      .update({
        name,
        type: type || null,
        grape: grape || null,
        region: region || null,
        country: country || null,
        vintage: vintage || null,
        notes: notes || null,
      })
      .eq("id", wineId)
      .select()
      .single();

    if (wineError) {
      console.error("Error updating wine:", wineError);
      return NextResponse.json(
        { error: `Failed to update wine: ${wineError.message || wineError.code}` },
        { status: 500 }
      );
    }

    // Update quantity in user_wines
    const { error: quantityError } = await authenticatedSupabase
      .from("user_wines")
      .update({
        quantity: quantity && quantity > 0 ? quantity : 1,
      })
      .eq("user_id", user.id)
      .eq("wine_id", wineId);

    if (quantityError) {
      console.error("Error updating quantity:", quantityError);
      // Don't fail the whole request if quantity update fails
      console.warn("Quantity update failed, but wine was updated");
    }

    return NextResponse.json({ success: true, wine: updatedWine });
  } catch (error: any) {
    console.error("Error updating wine:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update wine" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    // Create authenticated client
    const authenticatedSupabase = createAuthenticatedClient(accessToken);

    const { searchParams } = new URL(request.url);
    const wineId = searchParams.get("id");

    if (!wineId) {
      return NextResponse.json(
        { error: "Wine ID is required" },
        { status: 400 }
      );
    }

    // Remove from user_wines (not deleting the wine itself in case others have it)
    const { error } = await authenticatedSupabase
      .from("user_wines")
      .delete()
      .eq("user_id", user.id)
      .eq("wine_id", wineId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting wine:", error);
    return NextResponse.json(
      { error: "Failed to delete wine" },
      { status: 500 }
    );
  }
}

