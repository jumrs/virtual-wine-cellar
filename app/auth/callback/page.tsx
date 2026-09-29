"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Wine } from "lucide-react";
import { invalidateWineCache } from "@/hooks";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string>("Completing sign-in…");

  useEffect(() => {
    const run = async () => {
      try {
        // Supabase redirects back with a `code` param for PKCE flows (email confirmation, magic links, OAuth).
        const code = searchParams.get("code");
        if (!code) {
          setMessage("Missing authorization code. You can close this page and try signing in again.");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message || "Failed to complete sign-in.");
          return;
        }

        // Ensure no cross-user cached data survives the auth transition.
        invalidateWineCache();
        router.replace("/");
      } catch (err: any) {
        setMessage(err?.message || "Failed to complete sign-in.");
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Wine className="w-7 h-7 text-primary" />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wine className="w-7 h-7 text-primary" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading…</span>
            </div>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}


