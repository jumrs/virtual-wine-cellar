"use client";

import { PairingChat } from "@/components/PairingChat";
import { BottomNav } from "@/components/BottomNav";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuthGuard } from "@/hooks";

export default function PairingsPage() {
  const { user, loading } = useAuthGuard();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." size="lg" />;
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
            <h1 className="text-xl font-semibold">Wine Pairings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 page-container">
        <div className="max-w-2xl mx-auto">
          <PairingChat />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
