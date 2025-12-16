/**
 * API Utilities
 * Shared helpers for API route handlers
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createAuthenticatedClient } from "@/lib/supabaseServer";
import type { User } from "@supabase/supabase-js";

/** Standard API error response */
export interface ApiError {
  error: string;
  code?: string;
  details?: string;
}

/** Auth context for API handlers */
export interface AuthContext {
  user: User;
  accessToken: string;
  authenticatedSupabase: ReturnType<typeof createAuthenticatedClient>;
}

/**
 * Extract and validate authentication from request
 * @param request - Next.js request object
 * @returns Auth context or error response
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthContext | NextResponse<ApiError>> {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json(
      { error: `Unauthorized: ${authError?.message || "Invalid token"}` },
      { status: 401 }
    );
  }

  return {
    user,
    accessToken,
    authenticatedSupabase: createAuthenticatedClient(accessToken),
  };
}

/**
 * Check if the auth result is an error response
 */
export function isAuthError(
  result: AuthContext | NextResponse<ApiError>
): result is NextResponse<ApiError> {
  return result instanceof NextResponse;
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status = 500,
  code?: string
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, code },
    { status }
  );
}

/**
 * Create a success response with optional cache headers
 */
export function successResponse<T>(
  data: T,
  options?: {
    /** Cache duration in seconds (default: no cache) */
    cacheDuration?: number;
    /** Allow stale-while-revalidate (default: false) */
    staleWhileRevalidate?: number;
  }
): NextResponse<T> {
  const response = NextResponse.json(data);

  if (options?.cacheDuration) {
    let cacheControl = `private, max-age=${options.cacheDuration}`;
    if (options.staleWhileRevalidate) {
      cacheControl += `, stale-while-revalidate=${options.staleWhileRevalidate}`;
    }
    response.headers.set("Cache-Control", cacheControl);
  }

  return response;
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T>(request: NextRequest): Promise<T | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Get query parameter from URL
 */
export function getQueryParam(request: NextRequest, param: string): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get(param);
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Log API error with context
 */
export function logApiError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  console.error(`[API Error] ${context}:`, error);
  if (additionalInfo) {
    console.error("Additional info:", JSON.stringify(additionalInfo, null, 2));
  }
}

