import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";

// POST: Upload a new image
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;
    const wineId = formData.get("wineId") as string;

    if (!file || !wineId) {
      return NextResponse.json(
        { error: "Missing file or wine ID" },
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

    // Delete old image if it exists
    const { data: existingWine } = await authenticatedSupabase
      .from("wines")
      .select("label_image_url")
      .eq("id", wineId)
      .single();

    if (existingWine?.label_image_url) {
      // Extract the file path from the URL
      const url = new URL(existingWine.label_image_url);
      const pathParts = url.pathname.split("/");
      const fileName = pathParts[pathParts.length - 1];
      const filePath = `${user.id}/${fileName}`;

      // Delete old file from storage
      await authenticatedSupabase.storage
        .from("wine-labels")
        .remove([filePath]);
    }

    // Upload new image
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const fileBuffer = await file.arrayBuffer();

    const { data: uploadData, error: uploadError } = await authenticatedSupabase.storage
      .from("wine-labels")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload image: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = authenticatedSupabase.storage
      .from("wine-labels")
      .getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // Update wine with new image URL
    const { error: updateError } = await authenticatedSupabase
      .from("wines")
      .update({ label_image_url: imageUrl })
      .eq("id", wineId);

    if (updateError) {
      console.error("Error updating wine:", updateError);
      return NextResponse.json(
        { error: `Failed to update wine: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload image" },
      { status: 500 }
    );
  }
}

// DELETE: Remove image
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

    const body = await request.json();
    const { wineId } = body;

    if (!wineId) {
      return NextResponse.json(
        { error: "Missing wine ID" },
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

    // Get current image URL
    const { data: existingWine } = await authenticatedSupabase
      .from("wines")
      .select("label_image_url")
      .eq("id", wineId)
      .single();

    if (existingWine?.label_image_url) {
      // Extract the file path from the URL
      const url = new URL(existingWine.label_image_url);
      const pathParts = url.pathname.split("/");
      const fileName = pathParts[pathParts.length - 1];
      const filePath = `${user.id}/${fileName}`;

      // Delete file from storage
      await authenticatedSupabase.storage
        .from("wine-labels")
        .remove([filePath]);
    }

    // Update wine to remove image URL
    const { error: updateError } = await authenticatedSupabase
      .from("wines")
      .update({ label_image_url: null })
      .eq("id", wineId);

    if (updateError) {
      console.error("Error updating wine:", updateError);
      return NextResponse.json(
        { error: `Failed to remove image: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing image:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove image" },
      { status: 500 }
    );
  }
}
