"use client";

import { useCallback, useMemo, useState, lazy, Suspense } from "react";
import { WineCard } from "@/components/WineCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wine as WineIcon, ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthGuard, useWines, useDebounce, invalidateWineCache } from "@/hooks";
import { filterWinesByQuery } from "@/lib/wineUtils";
import type { Wine } from "@/types";

// Lazy load EditWineDialog
const EditWineDialog = lazy(() =>
  import("@/components/EditWineDialog").then((m) => ({ default: m.EditWineDialog }))
);

export default function SearchPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuthGuard();
  const { wines, loading: loadingWines, fetchWines, deleteWine } = useWines({
    autoFetch: isAuthenticated,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Debounce search for better performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filter wines by search query
  const filteredWines = useMemo(
    () => filterWinesByQuery(wines, debouncedSearch),
    [wines, debouncedSearch]
  );

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

  // Loading state
  if (authLoading) {
    return <LoadingSpinner fullScreen message="Loading..." size="lg" />;
  }

  // Not authenticated
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
            <h1 className="text-xl font-semibold font-serif">Search</h1>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="container mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search your cellar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 elegant-input text-base"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <main className="container mx-auto px-4 py-2 page-container">
        {loadingWines ? (
          <LoadingSpinner message="Loading wines..." />
        ) : searchQuery && filteredWines.length === 0 ? (
          <EmptyState
            icon={<Search className="w-full h-full" />}
            title="No wines found"
            description="Try a different search term"
          />
        ) : filteredWines.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? `${filteredWines.length} ${filteredWines.length === 1 ? "result" : "results"} for "${searchQuery}"`
                : `${filteredWines.length} wines in your cellar`}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredWines.map((wine) => (
                <WineCard
                  key={wine.id}
                  wine={wine}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onImageUpdate={fetchWines}
                  onQuantityUpdate={fetchWines}
                  isRanOut={(wine.quantity || 0) === 0}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="Your cellar is empty"
            description="Add some wines to start searching"
            action={
              <Link href="/upload">
                <Button className="rounded-full btn-wine">Add Your First Wine</Button>
              </Link>
            }
          />
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
