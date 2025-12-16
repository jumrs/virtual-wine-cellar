import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  validateImageFile,
  generateSafeFilename,
  isValidUUID,
  sanitizeErrorMessage,
} from "@/lib/security";

// POST: Upload a new image
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:image:${clientId}`, RATE_LIMITS.upload);
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

    const formData = await request.formData();
    const file = formData.get("image") as File;
    const wineId = formData.get("wineId") as string;

    if (!file || !wineId) {
      return NextResponse.json(
        { error: "Missing file or wine ID" },
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

    // Validate file
    const fileValidation = validateImageFile(file, 10);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error },
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

    // Upload new image with safe filename
    const fileName = generateSafeFilename(user.id, file.name);
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
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error uploading image:", error);
    }
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// DELETE: Remove image
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`wines:image:delete:${clientId}`, RATE_LIMITS.standard);
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

    const { wineId } = body;

    if (!wineId) {
      return NextResponse.json(
        { error: "Missing wine ID" },
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
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error removing image:", error);
    }
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
