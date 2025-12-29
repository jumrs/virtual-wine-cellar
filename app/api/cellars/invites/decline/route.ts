/**
 * Decline Invite API
 * Allows invited users to decline their own invites
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
 * DELETE /api/cellars/invites/decline?id=<inviteId> - Decline an invite
 */
export async function DELETE(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-invite:decline:${clientId}`, RATE_LIMITS.standard);
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

    // Get invite to verify it's for this user
    const { data: invite, error: inviteError } = await authenticatedSupabase
      .from("cellar_invites")
      .select("id, email")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return errorResponse("Invite not found", 404);
    }

    // Verify the invite is for this user's email
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      return errorResponse("This invite is not for you", 403);
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
    logApiError("DELETE /api/cellars/invites/decline", error);
    return errorResponse("Failed to decline invite");
  }
}

