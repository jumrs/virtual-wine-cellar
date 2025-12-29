"use client";

import { useAuth } from "@/components/AuthProvider";
import { useCellar } from "@/components/CellarProvider";
import { UploadForm } from "@/components/UploadForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wine, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";

export default function UploadPage() {
  const { user, loading } = useAuth();
  const { activeCellar, loading: loadingCellar, canEdit } = useCellar();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Redirect if user doesn't have edit permissions
  useEffect(() => {
    if (!loading && !loadingCellar && user && canEdit === false) {
      router.push("/");
    }
  }, [loading, loadingCellar, user, canEdit, router]);

  if (loading || loadingCellar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Wine className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full w-10 h-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold font-serif">Add Wine</h1>
              {activeCellar && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Adding to: {activeCellar.name}
                  {activeCellar.is_shared && <Users className="h-3 w-3" />}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 page-container">
        <div className="max-w-md mx-auto">
          <UploadForm cellarId={activeCellar?.id} />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
