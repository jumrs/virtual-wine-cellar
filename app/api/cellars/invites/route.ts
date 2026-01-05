/**
 * User's Pending Invites API
 * Fetch and manage invites for the current user
 */

import { NextRequest } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
  successResponse,
  logApiError,
} from "@/lib/apiUtils";
import {
  checkRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * GET /api/cellars/invites - Get pending invites for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`cellar-invites:get:${clientId}`, RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { user, authenticatedSupabase } = auth;

    if (!user.email) {
      return successResponse([]);
    }

    // Fetch pending invites for this user's email
    const { data: invites, error } = await authenticatedSupabase
      .from("cellar_invites")
      .select(`
        id,
        email,
        expires_at,
        created_at,
        token,
        cellar:cellars (
          id,
          name,
          owner_id
        ),
        inviter:profiles!cellar_invites_invited_by_fkey (
          id,
          name,
          username,
          email,
          avatar_url
        )
      `)
      .eq("email", user.email.toLowerCase())
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      // If the join fails (no profiles table or wrong FK), try simpler query
      const { data: simpleInvites, error: simpleError } = await authenticatedSupabase
        .from("cellar_invites")
        .select(`
          id,
          email,
          expires_at,
          created_at,
          token,
          cellar_id,
          invited_by
        `)
        .eq("email", user.email.toLowerCase())
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (simpleError) {
        throw simpleError;
      }

      // Fetch cellar names separately
      const cellarIds = simpleInvites?.map((i: any) => i.cellar_id).filter(Boolean) || [];
      let cellarsMap: Record<string, any> = {};
      
      if (cellarIds.length > 0) {
        const { data: cellars } = await authenticatedSupabase
          .from("cellars")
          .select("id, name, owner_id")
          .in("id", cellarIds);
        
        if (cellars) {
          cellarsMap = cellars.reduce((acc: Record<string, any>, c: any) => {
            acc[c.id] = c;
            return acc;
          }, {});
        }
      }

      const formatted = simpleInvites?.map((invite: any) => ({
        id: invite.id,
        email: invite.email,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
        token: invite.token,
        cellar: cellarsMap[invite.cellar_id] || null,
        inviter: null,
      })) || [];

      return successResponse(formatted);
    }

    // Format response
    const formatted = invites?.map((invite: any) => ({
      id: invite.id,
      email: invite.email,
      expires_at: invite.expires_at,
      created_at: invite.created_at,
      token: invite.token,
      cellar: invite.cellar,
      inviter: invite.inviter,
    })) || [];

    return successResponse(formatted);
  } catch (error) {
    logApiError("GET /api/cellars/invites", error);
    return errorResponse("Failed to fetch invites");
  }
}

