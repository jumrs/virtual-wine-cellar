"use client";

import { useCallback, useMemo, useState, lazy, Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { WineCard } from "@/components/WineCard";
import { Button } from "@/components/ui/button";
import { LogIn, Wine as WineIcon, Camera } from "lucide-react";
import Link from "next/link";
import { ConfigCheck } from "@/components/ConfigCheck";
import { WineFilters } from "@/components/WineFilters";
import { BottomNav } from "@/components/BottomNav";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useWines, invalidateWineCache } from "@/hooks";
import { separateWinesByQuantity, calculateWineStats } from "@/lib/wineUtils";
import type { Wine } from "@/types";

// Lazy load EditWineDialog - only loaded when editing
const EditWineDialog = lazy(() =>
  import("@/components/EditWineDialog").then((m) => ({ default: m.EditWineDialog }))
);

export default function Home() {
  const { user, profile, loading } = useAuth();
  const { wines, loading: loadingWines, fetchWines, deleteWine } = useWines({
    autoFetch: !!user,
  });
  const [filteredWines, setFilteredWines] = useState<Wine[]>([]);
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Memoized wine separation
  const { active: activeWines, ranOut: ranOutWines } = useMemo(
    () => separateWinesByQuantity(wines),
    [wines]
  );

  const filteredActiveWines = useMemo(
    () => filteredWines.filter((w) => (w.quantity || 0) > 0),
    [filteredWines]
  );

  const filteredRanOutWines = useMemo(
    () => filteredWines.filter((w) => (w.quantity || 0) === 0),
    [filteredWines]
  );

  // Memoized stats
  const stats = useMemo(() => calculateWineStats(activeWines), [activeWines]);

  // Event handlers
  const handleEdit = useCallback((wine: Wine) => {
    setEditingWine(wine);
    setEditDialogOpen(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    invalidateWineCache();
    fetchWines();
    setEditDialogOpen(false);
    setEditingWine(null);
  }, [fetchWines]);

  const handleDelete = useCallback(
    async (wineId: string) => {
      await deleteWine(wineId);
    },
    [deleteWine]
  );

  const handleFilterChange = useCallback((filtered: Wine[]) => {
    setFilteredWines(filtered);
  }, []);

  // Display name computation
  const displayName = useMemo(() => {
    const name = profile?.name || profile?.username || user?.email?.split("@")[0] || "My";
    return name === "My" ? "My Cellar" : `${name}'s Cellar`;
  }, [profile, user]);

  // Loading state
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading your cellar..." size="lg" />;
  }

  // Not authenticated - show landing
  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ConfigCheck />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-serif">{displayName}</h1>
              {wines.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {stats.activeWines} {stats.activeWines === 1 ? "wine" : "wines"} •{" "}
                  {stats.totalBottles} bottles
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 page-container">
        {loadingWines ? (
          <LoadingSpinner message="Loading your wines..." />
        ) : wines.length === 0 ? (
          <EmptyState
            title="Your cellar is empty"
            description="Start building your collection by scanning a wine label"
            action={
              <Link href="/upload">
                <Button className="rounded-full btn-wine">
                  <Camera className="h-4 w-4 mr-2" />
                  Scan Your First Wine
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-8">
            {/* Filters */}
            <WineFilters wines={wines} onFilterChange={handleFilterChange} />

            {/* Active Wines */}
            {filteredActiveWines.length > 0 && (
              <WineSection
                title="My Wines"
                wines={filteredActiveWines}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onRefresh={fetchWines}
              />
            )}

            {/* Ran Out Wines */}
            {filteredRanOutWines.length > 0 && (
              <WineSection
                title="Ran Out"
                wines={filteredRanOutWines}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onRefresh={fetchWines}
                isRanOut
                delay={200}
              />
            )}

            {/* No matches */}
            {filteredWines.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No wines match your filters. Try adjusting your search criteria.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Edit Dialog - Lazy loaded */}
      {editDialogOpen && (
        <Suspense fallback={null}>
          <EditWineDialog
            wine={editingWine}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSave={handleSaveEdit}
            onImageUpdate={fetchWines}
          />
        </Suspense>
      )}
    </div>
  );
}

// ============ Sub-components ============

/** Landing page for unauthenticated users */
function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <WineIcon className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-2 font-serif">My Cellar</h1>
          <p className="text-muted-foreground">
            Your personal wine collection, beautifully organized
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <FeatureCard
            icon={<Camera className="w-5 h-5 text-primary" />}
            title="AI Label Recognition"
            description="Scan labels to instantly add wines"
          />
          <FeatureCard
            icon={<WineIcon className="w-5 h-5 text-primary" />}
            title="Smart Pairings"
            description="Get AI suggestions for your meals"
          />
        </div>

        {/* Sign In */}
        <Link href="/auth" className="block">
          <Button className="w-full h-14 text-base rounded-full btn-wine">
            <LogIn className="h-5 w-5 mr-2" />
            Sign In to Continue
          </Button>
        </Link>
      </div>
    </div>
  );
}

/** Feature card for landing page */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 text-left p-4 rounded-2xl bg-card border border-border/50">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Wine section with title and grid */
function WineSection({
  title,
  wines,
  onDelete,
  onEdit,
  onRefresh,
  isRanOut = false,
  delay = 100,
}: {
  title: string;
  wines: Wine[];
  onDelete: (id: string) => void;
  onEdit: (wine: Wine) => void;
  onRefresh: () => void;
  isRanOut?: boolean;
  delay?: number;
}) {
  return (
    <section className="animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="section-header">
        <h2 className={`section-title ${isRanOut ? "text-muted-foreground" : ""}`}>
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {wines.length} {wines.length === 1 ? "wine" : "wines"}
        </span>
      </div>
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${!isRanOut ? "stagger-children" : ""}`}>
        {wines.map((wine) => (
          <WineCard
            key={wine.id}
            wine={wine}
            onDelete={onDelete}
            onEdit={onEdit}
            onImageUpdate={onRefresh}
            onQuantityUpdate={onRefresh}
            isRanOut={isRanOut}
          />
        ))}
      </div>
    </section>
  );
}
