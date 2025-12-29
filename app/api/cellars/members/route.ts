/**
 * Cellar Members API Routes
 * Manage cellar membership
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

export const dynamic = "force-dynamic";

/**
 * GET /api/cellars/members?cellarId=<id> - Get members of a cellar
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-members:get:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const cellarId = getQueryParam(request, "cellarId");

    if (!cellarId) {
      return errorResponse("Cellar ID is required", 400);
    }

    if (!isValidUUID(cellarId)) {
      return errorResponse("Invalid cellar ID format", 400);
    }

    // Verify user has access to this cellar
    const { data: membership, error: membershipError } = await authenticatedSupabase
      .from("cellar_members")
      .select("id")
      .eq("cellar_id", cellarId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return errorResponse("Access denied to this cellar", 403);
    }

    // Fetch all members
    const { data: members, error: membersError } = await authenticatedSupabase
      .from("cellar_members")
      .select(`
        id,
        cellar_id,
        user_id,
        role,
        added_at
      `)
      .eq("cellar_id", cellarId)
      .order("role", { ascending: true }) // owner first
      .order("added_at", { ascending: true });

    if (membersError) {
      throw membersError;
    }

    // Fetch profile info separately to handle missing profiles gracefully
    const userIds = members?.map((m: any) => m.user_id) || [];
    let profilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
      // Try to get profiles first
      const { data: profiles } = await authenticatedSupabase
        .from("profiles")
        .select("id, email, name, username, avatar_url")
        .in("id", userIds);

      if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      // For users without profiles, try to get their email from auth.users
      // This requires service role key
      const missingUserIds = userIds.filter((id: string) => !profilesMap[id] || !profilesMap[id].email);
      if (missingUserIds.length > 0) {
        // Try to get user info from auth.users using admin API
        for (const userId of missingUserIds) {
          try {
            const { data: authUser } = await authenticatedSupabase.auth.admin.getUserById(userId);
            if (authUser?.user) {
              const email = authUser.user.email;
              const metadata = authUser.user.user_metadata || {};
              profilesMap[userId] = {
                id: userId,
                email: email,
                name: metadata.full_name || metadata.name || null,
                username: metadata.username || (email ? email.split('@')[0] : null),
                avatar_url: metadata.avatar_url || null,
              };
            } else {
              // Set placeholder if we can't get user info
              profilesMap[userId] = profilesMap[userId] || {
                id: userId,
                email: null,
                name: null,
                username: null,
                avatar_url: null,
              };
            }
          } catch (err) {
            // If admin API fails, use existing profile data or placeholder
            profilesMap[userId] = profilesMap[userId] || {
              id: userId,
              email: null,
              name: null,
              username: null,
              avatar_url: null,
            };
          }
        }
      }
    }

    // Format response with profile data
    const formattedMembers = members?.map((m: any) => ({
      id: m.id,
      cellar_id: m.cellar_id,
      user_id: m.user_id,
      role: m.role,
      added_at: m.added_at,
      user: profilesMap[m.user_id] || null,
    })) || [];

    // Sort: owner first, then admins, then members
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    formattedMembers.sort((a: any, b: any) => {
      const orderA = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
      const orderB = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
      return orderA - orderB;
    });

    return successResponse(formattedMembers);
  } catch (error) {
    logApiError("GET /api/cellars/members", error);
    return errorResponse("Failed to fetch members");
  }
}

/**
 * PATCH /api/cellars/members - Update member role
 */
export async function PATCH(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-members:patch:${clientId}`, RATE_LIMITS.standard);
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

    const { cellarId, userId, role } = body;

    if (!cellarId || !userId || !role) {
      return errorResponse("Cellar ID, User ID, and role are required", 400);
    }

    if (!isValidUUID(cellarId) || !isValidUUID(userId)) {
      return errorResponse("Invalid ID format", 400);
    }

    // Validate role
    if (!["admin", "member"].includes(role)) {
      return errorResponse("Invalid role. Must be 'admin' or 'member'", 400);
    }

    // Get cellar info
    const { data: cellar, error: cellarError } = await authenticatedSupabase
      .from("cellars")
      .select("owner_id")
      .eq("id", cellarId)
      .single();

    if (cellarError || !cellar) {
      return errorResponse("Cellar not found", 404);
    }

    // Only owner can change roles
    if (cellar.owner_id !== user.id) {
      return errorResponse("Only the owner can change member roles", 403);
    }

    // Can't change owner's role
    if (userId === cellar.owner_id) {
      return errorResponse("Cannot change the owner's role", 400);
    }

    // Update the member's role
    const { error: updateError } = await authenticatedSupabase
      .from("cellar_members")
      .update({ role })
      .eq("cellar_id", cellarId)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    return successResponse({ success: true, role });
  } catch (error) {
    logApiError("PATCH /api/cellars/members", error);
    return errorResponse("Failed to update member role");
  }
}

/**
 * DELETE /api/cellars/members?cellarId=<id>&userId=<id> - Remove member from cellar
 */
export async function DELETE(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-members:delete:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;
    const cellarId = getQueryParam(request, "cellarId");
    const targetUserId = getQueryParam(request, "userId");

    if (!cellarId || !targetUserId) {
      return errorResponse("Cellar ID and User ID are required", 400);
    }

    if (!isValidUUID(cellarId) || !isValidUUID(targetUserId)) {
      return errorResponse("Invalid ID format", 400);
    }

    // Get cellar info
    const { data: cellar, error: cellarError } = await authenticatedSupabase
      .from("cellars")
      .select("owner_id")
      .eq("id", cellarId)
      .single();

    if (cellarError || !cellar) {
      return errorResponse("Cellar not found", 404);
    }

    // Get current user's membership to check if they're admin
    const { data: currentMembership } = await authenticatedSupabase
      .from("cellar_members")
      .select("role")
      .eq("cellar_id", cellarId)
      .eq("user_id", user.id)
      .single();

    // Check permissions
    const isOwner = cellar.owner_id === user.id;
    const isAdmin = currentMembership?.role === "admin";
    const isSelf = targetUserId === user.id;

    // Get target user's role
    const { data: targetMembership } = await authenticatedSupabase
      .from("cellar_members")
      .select("role")
      .eq("cellar_id", cellarId)
      .eq("user_id", targetUserId)
      .single();

    const targetIsOwner = targetUserId === cellar.owner_id;
    const targetIsAdmin = targetMembership?.role === "admin";

    // Owner cannot remove themselves
    if (targetIsOwner && isSelf) {
      return errorResponse("Owner cannot leave their own cellar. Transfer ownership or delete the cellar instead.", 400);
    }

    // Admins can remove members but not other admins or owner
    if (isAdmin && !isOwner) {
      if (targetIsOwner || targetIsAdmin) {
        return errorResponse("Admins cannot remove the owner or other admins", 403);
      }
    }

    // Regular members can only remove themselves
    if (!isOwner && !isAdmin && !isSelf) {
      return errorResponse("You don't have permission to remove other members", 403);
    }

    // Remove the member
    const { error: deleteError } = await authenticatedSupabase
      .from("cellar_members")
      .delete()
      .eq("cellar_id", cellarId)
      .eq("user_id", targetUserId);

    if (deleteError) {
      throw deleteError;
    }

    return successResponse({ success: true });
  } catch (error) {
    logApiError("DELETE /api/cellars/members", error);
    return errorResponse("Failed to remove member");
  }
}

