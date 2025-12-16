import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  sanitizeTextInput,
  sanitizeErrorMessage,
} from "@/lib/security";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`profile:get:${clientId}`, RATE_LIMITS.standard);
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

    // Get user profile - select only necessary fields
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("username, name, avatar_url")
      .eq("id", user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 is "not found" - we'll create a default profile
      console.error("Error fetching profile:", profileError);
    }

    // Return profile or default
    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: profile?.username || null,
      name: profile?.name || null,
      avatar_url: profile?.avatar_url || null,
    });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in GET /api/profile:", error);
    }
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`profile:put:${clientId}`, RATE_LIMITS.standard);
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Sanitize inputs
    const username = body.username !== undefined 
      ? sanitizeTextInput(body.username) || null
      : undefined;
    const name = body.name !== undefined 
      ? sanitizeTextInput(body.name) || null
      : undefined;
    const avatar_url = body.avatar_url; // URL validation is handled separately

    // Validate username if provided
    if (username !== undefined && username !== null) {
      if (username.length < 3 || username.length > 20) {
        return NextResponse.json(
          { error: "Username must be between 3 and 20 characters" },
          { status: 400 }
        );
      }

      // Validate username format (alphanumeric and underscores only)
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return NextResponse.json(
          { error: "Username can only contain letters, numbers, and underscores" },
          { status: 400 }
        );
      }

      // Check if username is already taken (by another user)
      if (username) {
        const { data: existing } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("username", username)
          .neq("id", user.id)
          .single();

        if (existing) {
          return NextResponse.json(
            { error: "Username already taken" },
            { status: 400 }
          );
        }
      }
    }

    // Validate name length if provided
    if (name !== undefined && name !== null && name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Update or insert profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          username: username !== undefined ? username : null,
          name: name !== undefined ? name : null,
          avatar_url: avatar_url !== undefined ? avatar_url : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      )
      .select()
      .single();

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: profile.username,
      name: profile.name,
      avatar_url: profile.avatar_url,
    });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in PUT /api/profile:", error);
    }
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}



