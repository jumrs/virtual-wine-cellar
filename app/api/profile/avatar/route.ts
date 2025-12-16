import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  validateImageFile,
  generateSafeFilename,
  sanitizeErrorMessage,
} from "@/lib/security";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`profile:avatar:${clientId}`, RATE_LIMITS.upload);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the token and get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file using security utility (5MB max for avatars)
    const fileValidation = validateImageFile(file, 5);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    // Generate safe filename
    const safeFileName = generateSafeFilename(user.id, file.name);
    const filePath = `avatars/${safeFileName}`;

    // Delete old avatar if exists
    const { data: oldProfile } = await supabase
      .from("user_profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    if (oldProfile?.avatar_url) {
      const oldPath = oldProfile.avatar_url.split("/").slice(-2).join("/");
      await supabase.storage.from("avatars").remove([oldPath]);
    }

    // Upload new avatar
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(safeFileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error uploading avatar:", uploadError);
      }
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(safeFileName);

    // Update profile with new avatar URL
    await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    return NextResponse.json({ avatar_url: publicUrl });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in POST /api/profile/avatar:", error);
    }
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}



