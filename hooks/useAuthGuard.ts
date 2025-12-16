/**
 * Auth Guard Hook
 * Handles authentication checks and redirects for protected pages
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface UseAuthGuardOptions {
  /** Redirect path when not authenticated (default: "/") */
  redirectTo?: string;
  /** Whether to redirect (default: true) */
  redirect?: boolean;
}

interface UseAuthGuardReturn {
  /** Current user (null if not authenticated) */
  user: ReturnType<typeof useAuth>["user"];
  /** User profile */
  profile: ReturnType<typeof useAuth>["profile"];
  /** Loading state */
  loading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Sign out function */
  signOut: () => Promise<void>;
  /** Refresh profile data */
  refreshProfile: () => Promise<void>;
}

/**
 * Custom hook for protecting routes that require authentication
 * Automatically redirects unauthenticated users
 * 
 * @example
 * function ProtectedPage() {
 *   const { user, loading, isAuthenticated } = useAuthGuard();
 *   
 *   if (loading) return <LoadingSpinner />;
 *   if (!isAuthenticated) return null;
 *   
 *   return <div>Protected content for {user?.email}</div>;
 * }
 */
export function useAuthGuard(options: UseAuthGuardOptions = {}): UseAuthGuardReturn {
  const { redirectTo = "/", redirect = true } = options;
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && redirect) {
      router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo, redirect]);

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    signOut,
    refreshProfile,
  };
}

/**
 * Get display name from user profile or email
 */
export function getDisplayName(
  profile: ReturnType<typeof useAuth>["profile"],
  user: ReturnType<typeof useAuth>["user"]
): string {
  if (profile?.name) return profile.name;
  if (profile?.username) return profile.username;
  if (user?.email) return user.email.split("@")[0];
  return "User";
}

