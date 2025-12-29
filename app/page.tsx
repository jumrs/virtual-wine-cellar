"use client";

import { useCallback, useMemo, useState, lazy, Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCellar } from "@/components/CellarProvider";
import { WineCard } from "@/components/WineCard";
import { Button } from "@/components/ui/button";
import { LogIn, Wine as WineIcon, Camera, Users } from "lucide-react";
import Link from "next/link";
import { ConfigCheck } from "@/components/ConfigCheck";
import { WineFilters } from "@/components/WineFilters";
import { BottomNav } from "@/components/BottomNav";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useWines, invalidateWineCache, useCellarRealtime } from "@/hooks";
import { separateWinesByQuantity, calculateWineStats } from "@/lib/wineUtils";
import { CellarSwitcher } from "@/components/CellarSwitcher";
import { ShareCellarDialog } from "@/components/ShareCellarDialog";
import { PendingInvites } from "@/components/PendingInvites";
import type { Wine, Cellar } from "@/types";

// Lazy load EditWineDialog - only loaded when editing
const EditWineDialog = lazy(() =>
  import("@/components/EditWineDialog").then((m) => ({ default: m.EditWineDialog }))
);

export default function Home() {
  const { user, profile, loading } = useAuth();
  const { activeCellar, loading: loadingCellar } = useCellar();
  const { wines, loading: loadingWines, fetchWines, deleteWine } = useWines({
    autoFetch: !!user && !!activeCellar,
    cellarId: activeCellar?.id,
  });
  const [filteredWines, setFilteredWines] = useState<Wine[]>([]);
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cellarSettingsOpen, setCellarSettingsOpen] = useState(false);
  const [settingsCellar, setSettingsCellar] = useState<Cellar | null>(null);

  // Real-time subscriptions for cellar changes
  useCellarRealtime({
    cellarId: activeCellar?.id,
    onWinesChange: fetchWines,
    showNotifications: true,
  });

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

  // Display name computation - use cellar name if available
  const displayName = useMemo(() => {
    if (activeCellar?.name) {
      return activeCellar.name;
    }
    const name = profile?.name || profile?.username || user?.email?.split("@")[0] || "My";
    return name === "My" ? "My Cellar" : `${name}'s Cellar`;
  }, [profile, user, activeCellar]);

  // Handle cellar settings click
  const handleCellarSettings = useCallback((cellar: Cellar) => {
    setSettingsCellar(cellar);
    setCellarSettingsOpen(true);
  }, []);

  // Loading state
  if (loading || loadingCellar) {
    return <LoadingSpinner fullScreen message="Loading your cellar..." size="lg" />;
  }

  // Not authenticated - show landing
  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      <ConfigCheck />

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
      <header className="relative z-10 sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Cellar Switcher */}
              <CellarSwitcher onSettingsClick={handleCellarSettings} />
              
              {/* Stats */}
              {wines.length > 0 && (
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground pl-2">
                  <span>
                    {stats.activeWines} {stats.activeWines === 1 ? "wine" : "wines"} •{" "}
                    {stats.totalBottles} bottles
                  </span>
                  {activeCellar?.is_shared && (
                    <span className="flex items-center gap-1 text-primary">
                      <Users className="h-3 w-3" />
                      Shared
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 container mx-auto px-4 py-6 page-container">
        {/* Pending Invites */}
        <PendingInvites onInviteAccepted={fetchWines} />

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

      {/* Footer decoration */}
      <footer className="relative z-10 h-24 bg-gradient-to-t from-primary/5 to-transparent" />

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

      {/* Cellar Settings Dialog */}
      {settingsCellar && (
        <ShareCellarDialog
          open={cellarSettingsOpen}
          onOpenChange={setCellarSettingsOpen}
          cellar={settingsCellar}
        />
      )}
    </div>
  );
}

// ============ Sub-components ============

/** Landing page for unauthenticated users */
function LandingPage() {
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

      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
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
            <Button className="w-full h-14 text-base rounded-2xl bg-gradient-to-r from-primary to-wine-burgundy hover:from-primary/90 hover:to-wine-burgundy/90 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300">
              <LogIn className="h-5 w-5 mr-2" />
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer decoration */}
      <footer className="relative z-10 h-24 bg-gradient-to-t from-primary/5 to-transparent" />
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
    <div className="flex items-center gap-3 text-left p-4 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg shadow-black/5">
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
