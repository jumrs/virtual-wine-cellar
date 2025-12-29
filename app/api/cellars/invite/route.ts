/**
 * Cellar Invite API Routes
 * Handle cellar sharing invitations
 */

import { NextRequest } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
  successResponse,
  getQueryParam,
  logApiError,
} from "@/lib/apiUtils";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
  isValidUUID,
} from "@/lib/security";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Generate a secure random token
 */
function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * POST /api/cellars/invite - Create an invite
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-invite:post:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { cellarId, email } = body;

    if (!cellarId || !email) {
      return errorResponse("Cellar ID and email are required", 400);
    }

    if (!isValidUUID(cellarId)) {
      return errorResponse("Invalid cellar ID format", 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email format", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Can't invite yourself
    if (user.email?.toLowerCase() === normalizedEmail) {
      return errorResponse("You cannot invite yourself", 400);
    }

    // Verify cellar exists and get user's role
    const { data: cellar, error: cellarError } = await authenticatedSupabase
      .from("cellars")
      .select("id, name, owner_id")
      .eq("id", cellarId)
      .single();

    if (cellarError || !cellar) {
      return errorResponse("Cellar not found", 404);
    }

    // Check if user is owner or admin
    const isOwner = cellar.owner_id === user.id;
    let isAdmin = false;

    if (!isOwner) {
      const { data: membership } = await authenticatedSupabase
        .from("cellar_members")
        .select("role")
        .eq("cellar_id", cellarId)
        .eq("user_id", user.id)
        .single();

      isAdmin = membership?.role === "admin";
    }

    if (!isOwner && !isAdmin) {
      return errorResponse("Only the owner or admins can invite members", 403);
    }

    // Check if user with this email exists
    const { data: existingUser } = await authenticatedSupabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      // User exists - check if already a member
      const { data: existingMember } = await authenticatedSupabase
        .from("cellar_members")
        .select("id")
        .eq("cellar_id", cellarId)
        .eq("user_id", existingUser.id)
        .single();

      if (existingMember) {
        return errorResponse("This user is already a member of this cellar", 400);
      }

      // Check if there's already a pending invite
      const { data: existingInvite } = await authenticatedSupabase
        .from("cellar_invites")
        .select("id")
        .eq("cellar_id", cellarId)
        .eq("email", normalizedEmail)
        .single();

      if (existingInvite) {
        return errorResponse("An invite has already been sent to this user", 400);
      }
    }

    // Create an invite (for both existing and new users - they need to accept)
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Delete any existing invite for this email/cellar
    await authenticatedSupabase
      .from("cellar_invites")
      .delete()
      .eq("cellar_id", cellarId)
      .eq("email", normalizedEmail);

    // Create new invite
    const { data: invite, error: inviteError } = await authenticatedSupabase
      .from("cellar_invites")
      .insert({
        cellar_id: cellarId,
        email: normalizedEmail,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // In production, you would send an email here
    // For now, we'll return the invite token for testing
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth?invite=${token}`;

    return successResponse({
      success: true,
      type: "invited",
      message: `Invitation sent to ${normalizedEmail}`,
      invite: {
        id: invite.id,
        email: normalizedEmail,
        expires_at: invite.expires_at,
        // Include URL for testing (in production, this would only be sent via email)
        invite_url: inviteUrl,
      },
    });
  } catch (error: any) {
    logApiError("POST /api/cellars/invite", error);
    return errorResponse(error.message || "Failed to create invite");
  }
}

/**
 * GET /api/cellars/invite?token=<token> - Get invite details by token
 */
export async function GET(request: NextRequest) {
  try {
    const token = getQueryParam(request, "token");

    if (!token) {
      return errorResponse("Invite token is required", 400);
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { authenticatedSupabase } = auth;

    // Find the invite
    const { data: invite, error: inviteError } = await authenticatedSupabase
      .from("cellar_invites")
      .select(`
        id,
        email,
        expires_at,
        cellar:cellars (
          id,
          name
        ),
        inviter:invited_by (
          name,
          username,
          email
        )
      `)
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return errorResponse("Invalid or expired invite", 404);
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return errorResponse("This invite has expired", 410);
    }

    return successResponse({
      valid: true,
      invite: {
        cellar_name: (invite.cellar as any)?.name,
        invited_by: (invite.inviter as any)?.name || (invite.inviter as any)?.email,
        email: invite.email,
        expires_at: invite.expires_at,
      },
    });
  } catch (error) {
    logApiError("GET /api/cellars/invite", error);
    return errorResponse("Failed to get invite details");
  }
}

/**
 * PUT /api/cellars/invite - Accept an invite
 */
export async function PUT(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-invite:accept:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { token } = body;

    if (!token) {
      return errorResponse("Invite token is required", 400);
    }

    // Find the invite
    const { data: invite, error: inviteError } = await authenticatedSupabase
      .from("cellar_invites")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return errorResponse("Invalid invite token", 404);
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      // Delete expired invite
      await authenticatedSupabase.from("cellar_invites").delete().eq("id", invite.id);
      return errorResponse("This invite has expired", 410);
    }

    // Check if email matches
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return errorResponse(
        `This invite was sent to ${invite.email}. Please sign in with that email address.`,
        403
      );
    }

    // Check if already a member
    const { data: existingMember } = await authenticatedSupabase
      .from("cellar_members")
      .select("id")
      .eq("cellar_id", invite.cellar_id)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      // Already a member - delete the invite and return success
      await authenticatedSupabase.from("cellar_invites").delete().eq("id", invite.id);
      return successResponse({
        success: true,
        message: "You are already a member of this cellar",
        cellar_id: invite.cellar_id,
      });
    }

    // Add user as member
    const { error: memberError } = await authenticatedSupabase
      .from("cellar_members")
      .insert({
        cellar_id: invite.cellar_id,
        user_id: user.id,
        role: "member",
      });

    if (memberError) {
      throw memberError;
    }

    // Delete the used invite
    await authenticatedSupabase.from("cellar_invites").delete().eq("id", invite.id);

    // Get cellar details
    const { data: cellar } = await authenticatedSupabase
      .from("cellars")
      .select("id, name")
      .eq("id", invite.cellar_id)
      .single();

    return successResponse({
      success: true,
      message: `You've joined "${cellar?.name || "the cellar"}"`,
      cellar_id: invite.cellar_id,
      cellar,
    });
  } catch (error: any) {
    logApiError("PUT /api/cellars/invite", error);
    return errorResponse(error.message || "Failed to accept invite");
  }
}

/**
 * DELETE /api/cellars/invite?id=<inviteId> - Cancel/delete an invite
 */
export async function DELETE(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-invite:delete:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const inviteId = getQueryParam(request, "id");

    if (!inviteId) {
      return errorResponse("Invite ID is required", 400);
    }

    if (!isValidUUID(inviteId)) {
      return errorResponse("Invalid invite ID format", 400);
    }

    // Get invite to check ownership
    const { data: invite, error: inviteError } = await authenticatedSupabase
      .from("cellar_invites")
      .select("cellar_id")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return errorResponse("Invite not found", 404);
    }

    // Verify user owns the cellar
    const { data: cellar } = await authenticatedSupabase
      .from("cellars")
      .select("owner_id")
      .eq("id", invite.cellar_id)
      .single();

    if (!cellar || cellar.owner_id !== user.id) {
      return errorResponse("Only the cellar owner can delete invites", 403);
    }

    // Delete the invite
    const { error: deleteError } = await authenticatedSupabase
      .from("cellar_invites")
      .delete()
      .eq("id", inviteId);

    if (deleteError) {
      throw deleteError;
    }

    return successResponse({ success: true });
  } catch (error) {
    logApiError("DELETE /api/cellars/invite", error);
    return errorResponse("Failed to delete invite");
  }
}

