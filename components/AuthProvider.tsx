"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { Toaster } from "@/components/ui/toaster";
import { invalidateWineCache } from "@/hooks";

function isEmailConfirmed(user: User): boolean {
  // Supabase sets confirmed_at / email_confirmed_at when the email is verified.
  // If email confirmations are disabled in the Supabase project, users may be auto-confirmed.
  const anyUser = user as any;
  // IMPORTANT: Prefer email_confirmed_at when present. Some environments may populate confirmed_at
  // even when email_confirmed_at is still null, so using `|| confirmed_at` can incorrectly allow access.
  if (anyUser && Object.prototype.hasOwnProperty.call(anyUser, "email_confirmed_at")) {
    return Boolean(anyUser.email_confirmed_at);
  }
  return Boolean(anyUser?.confirmed_at);
}

interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) return;

      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session with timeout
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("Supabase session check timed out. Check your environment variables.");
        setLoading(false);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeoutId);
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        if (mounted) {
          const currentUser = session?.user ?? null;
          if (currentUser && !isEmailConfirmed(currentUser)) {
            // Prevent access when an account hasn't confirmed their email (when confirmations are enabled).
            // If your Supabase project has email confirmations disabled, users will be auto-confirmed.
            setUser(null);
            setProfile(null);
            void supabase.auth.signOut({ scope: "global" });
          } else {
            setUser(currentUser);
            if (currentUser) {
              fetchProfile(currentUser.id);
            }
          }
          setLoading(false);
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error("Failed to get session:", error);
        if (mounted) {
          setLoading(false);
        }
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        // Prevent cross-user UI leaks from in-memory caches when switching accounts.
        invalidateWineCache();
        const currentUser = session?.user ?? null;
        if (currentUser && !isEmailConfirmed(currentUser)) {
          setUser(null);
          setProfile(null);
          void supabase.auth.signOut({ scope: "global" });
        } else {
          setUser(currentUser);
          if (currentUser) {
            fetchProfile(currentUser.id);
          } else {
            setProfile(null);
          }
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear cached wine data BEFORE signing out to prevent cross-user leaks
    invalidateWineCache();
    // Clear user state immediately for responsive UI
    setUser(null);
    setProfile(null);
    // Sign out with global scope to clear all sessions (including other tabs)
    await supabase.auth.signOut({ scope: 'global' });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
      <Toaster />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

