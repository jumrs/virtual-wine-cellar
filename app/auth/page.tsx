"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Wine, Loader2, ArrowRight, Eye, EyeOff, Sparkles, GlassWater, Mail } from "lucide-react";
import Link from "next/link";
import { invalidateWineCache } from "@/hooks";
import { useAuth } from "@/components/AuthProvider";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const emailRedirectTo = useMemo(() => {
    // Supabase will embed this into the verification email link.
    // We complete the flow on /auth/callback by exchanging the code for a session.
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/callback`;
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // CRITICAL: Always invalidate cache before any auth operation
      // This prevents cross-user data leaks
      invalidateWineCache();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: emailRedirectTo ? { emailRedirectTo } : undefined,
        });

        if (error) throw error;

        const anyUser = data.user as any;
        const hasEmailConfirmedField =
          anyUser && Object.prototype.hasOwnProperty.call(anyUser, "email_confirmed_at");
        const isConfirmed = hasEmailConfirmedField
          ? Boolean(anyUser?.email_confirmed_at)
          : Boolean(anyUser?.confirmed_at);

        // If email confirmations are enabled, users should not be able to proceed until confirmed.
        // Even if a session was returned, we enforce confirmation here to match your desired behavior.
        if (!isConfirmed) {
          await supabase.auth.signOut({ scope: "global" });
          setPendingConfirmation(true);
          toast({
            title: "Check your inbox",
            description:
              "We sent you a confirmation email. Open it to verify your account, then come back here.",
          });
        } else {
          // Confirmed immediately (either confirmations disabled, or the user is already confirmed).
          invalidateWineCache();
          toast({
            title: "Account created (no email confirmation required)",
            description:
              "Your Supabase project appears to have email confirmations disabled, so no verification email is sent. If you want email verification, enable it in Supabase Auth settings.",
          });
          router.push("/");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // If confirmations are enabled, unconfirmed users should not be able to proceed.
        const { data: { session } } = await supabase.auth.getSession();
        const anyUser = session?.user as any;
        const hasEmailConfirmedField =
          anyUser && Object.prototype.hasOwnProperty.call(anyUser, "email_confirmed_at");
        const confirmed = hasEmailConfirmedField
          ? Boolean(anyUser?.email_confirmed_at)
          : Boolean(anyUser?.confirmed_at);
        if (!confirmed) {
          await supabase.auth.signOut({ scope: "global" });
          invalidateWineCache();
          setPendingConfirmation(true);
          toast({
            title: "Confirm your email",
            description: "Please verify your email address before signing in.",
            variant: "destructive",
          });
          return;
        }

        // Double-check cache is cleared after successful sign in
        invalidateWineCache();

        toast({
          title: "Welcome back!",
          description: "Signed in successfully.",
        });

        router.push("/");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error?.message?.includes("Email not confirmed")
            ? "Your email isn’t confirmed yet. Check your inbox (and spam), or resend the confirmation email below."
            : error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast({
        title: "Enter your email",
        description: "Please enter the email address you signed up with.",
        variant: "destructive",
      });
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      if (error) throw error;
      toast({
        title: "Confirmation email resent",
        description: "Check your inbox and spam folder.",
      });
    } catch (err: any) {
      toast({
        title: "Couldn't resend email",
        description: err?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Wine stain effect */}
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-wine-burgundy/5 blur-3xl" />
        
        {/* Subtle pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23722F37' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2.5 text-foreground/80 hover:text-foreground transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <Wine className="w-5 h-5 text-primary" />
          </div>
          <span className="font-serif font-semibold text-lg">My Cellar</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Hero Section */}
          <div className="text-center mb-10">
            {/* Animated wine glass icon */}
            <div className="relative w-28 h-28 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-wine-burgundy/20 animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/10 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Wine className="h-14 w-14 text-primary drop-shadow-sm" />
              </div>
              {/* Sparkle accents */}
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-wine-gold/70 animate-pulse" style={{ animationDelay: "0.5s" }} />
              <GlassWater className="absolute -bottom-1 -left-1 w-4 h-4 text-primary/40 animate-pulse" style={{ animationDelay: "1s" }} />
            </div>
            
            <h1 className="text-4xl font-bold font-serif mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {isSignUp ? "Join the Cellar" : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground text-lg">
              {isSignUp 
                ? "Begin your wine journey today" 
                : "Your collection awaits"}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-card/80 backdrop-blur-xl rounded-3xl border border-border/50 p-8 shadow-xl shadow-black/5">
            {pendingConfirmation && (
              <div className="mb-6 rounded-2xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Confirm your email to continue</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We sent a confirmation email to <span className="font-medium text-foreground/80">{email}</span>.
                      Open it to verify your account.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-xl"
                        onClick={handleResend}
                        disabled={resending}
                      >
                        {resending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resending…
                          </>
                        ) : (
                          "Resend email"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => {
                          setPendingConfirmation(false);
                          setIsSignUp(false);
                        }}
                      >
                        Back to sign in
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="sommelier@vineyard.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-14 rounded-2xl bg-muted/30 border-border/50 px-5 text-base placeholder:text-muted-foreground/50 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    className="h-14 rounded-2xl bg-muted/30 border-border/50 px-5 pr-14 text-base placeholder:text-muted-foreground/50 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-muted-foreground pl-1">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-primary to-wine-burgundy hover:from-primary/90 hover:to-wine-burgundy/90 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 group" 
                disabled={loading || pendingConfirmation}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? "Create Account" : "Sign In"}
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-4 text-muted-foreground/70">
                  {isSignUp ? "Already a member?" : "New to My Cellar?"}
                </span>
              </div>
            </div>

            {/* Toggle Sign Up / Sign In */}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setPassword(""); // Clear password when switching modes
                setPendingConfirmation(false);
              }}
              className="w-full h-12 rounded-2xl border-2 border-border/50 text-foreground/80 font-medium hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
            >
              {isSignUp ? "Sign in to existing account" : "Create a new account"}
            </button>
          </div>

          {/* Security note */}
          <p className="text-center text-xs text-muted-foreground/60 mt-6 px-4">
            Your cellar data is private and secure. Only you can access your wine collection.
          </p>
        </div>
      </main>

      {/* Footer decoration */}
      <footer className="relative z-10 h-24 bg-gradient-to-t from-primary/5 to-transparent" />
    </div>
  );
}
