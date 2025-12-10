"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { WineCard, type Wine } from "@/components/WineCard";
import { Button } from "@/components/ui/button";
import { Plus, LogIn, Wine as WineIcon, Camera, LogOut, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { ConfigCheck } from "@/components/ConfigCheck";
import { EditWineDialog } from "@/components/EditWineDialog";
import { WineFilters } from "@/components/WineFilters";
import { BottomNav } from "@/components/BottomNav";
import Image from "next/image";

// Sort wines: by country (alphabetically), then by name (alphabetically) within each country
function sortWinesByCountryAndName(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
    const countryA = a.country || "ZZZ_No Country";
    const countryB = b.country || "ZZZ_No Country";
    
    if (countryA !== countryB) {
      return countryA.localeCompare(countryB);
    }
    
    return (a.name || "").localeCompare(b.name || "");
  });
}

export default function Home() {
  const { user, profile, loading, signOut } = useAuth();
  const [wines, setWines] = useState<Wine[]>([]);
  const [filteredWines, setFilteredWines] = useState<Wine[]>([]);
  const [loadingWines, setLoadingWines] = useState(false);
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Separate wines into active (quantity > 0) and ran out (quantity === 0)
  const activeWines = wines.filter(w => (w.quantity || 0) > 0);
  const ranOutWines = wines.filter(w => (w.quantity || 0) === 0);
  
  // Filter active wines
  const filteredActiveWines = filteredWines.filter(w => (w.quantity || 0) > 0);
  const filteredRanOutWines = filteredWines.filter(w => (w.quantity || 0) === 0);

  // Get recent wines (last 5 added)
  const recentWines = [...activeWines]
    .sort((a, b) => new Date(b.date_added || 0).getTime() - new Date(a.date_added || 0).getTime())
    .slice(0, 3);

  useEffect(() => {
    if (user) {
      fetchWines();
    }
  }, [user]);

  const fetchWines = async () => {
    if (!user) return;

    setLoadingWines(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("No access token");
      }

      const response = await fetch("/api/wines", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch wines");
      }

      const data = await response.json();
      const sortedWines = sortWinesByCountryAndName(data);
      
      setWines(sortedWines);
      setFilteredWines(sortedWines);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load your wines. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingWines(false);
    }
  };

  const handleEdit = (wine: Wine) => {
    setEditingWine(wine);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    fetchWines();
    setEditDialogOpen(false);
    setEditingWine(null);
  };

  const handleDelete = async (wineId: string) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("No access token");
      }

      const response = await fetch(`/api/wines?id=${wineId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete wine");
      }

      setWines((prevWines) => {
        const updated = prevWines.filter((w) => w.id !== wineId);
        return sortWinesByCountryAndName(updated);
      });
      toast({
        title: "Success",
        description: "Wine removed from your cellar.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete wine. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <WineIcon className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading your cellar...</p>
        </div>
      </div>
    );
  }

  if (!user) {
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
            <div className="flex items-center gap-3 text-left p-4 rounded-2xl bg-card border border-border/50">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">AI Label Recognition</p>
                <p className="text-sm text-muted-foreground">Scan labels to instantly add wines</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left p-4 rounded-2xl bg-card border border-border/50">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <WineIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Smart Pairings</p>
                <p className="text-sm text-muted-foreground">Get AI suggestions for your meals</p>
              </div>
            </div>
          </div>

          {/* Sign In Button */}
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

  return (
    <div className="min-h-screen bg-background">
      <ConfigCheck />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-serif">
                {(() => {
                  const displayName = profile?.name || profile?.username || (user.email?.split("@")[0] || "My");
                  return displayName === "My" ? "My Cellar" : `${displayName}'s Cellar`;
                })()}
              </h1>
              {wines.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {activeWines.length} {activeWines.length === 1 ? "wine" : "wines"} • {activeWines.reduce((sum, wine) => sum + (wine.quantity || 0), 0)} bottles
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/upload" className="md:hidden">
                <Button size="icon" variant="ghost" className="rounded-full w-10 h-10">
                  <Plus className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/upload" className="hidden md:flex">
                <Button className="rounded-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Wine
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={signOut}
                className="rounded-full w-10 h-10"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 page-container">
        {loadingWines ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <WineIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-muted-foreground">Loading your wines...</p>
          </div>
        ) : wines.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <WineIcon className="w-full h-full" />
            </div>
            <h3 className="empty-state-title">Your cellar is empty</h3>
            <p className="empty-state-text">
              Start building your collection by scanning a wine label
            </p>
            <Link href="/upload">
              <Button className="rounded-full btn-wine">
                <Camera className="h-4 w-4 mr-2" />
                Scan Your First Wine
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Recent Scans Section */}
            {recentWines.length > 0 && (
              <section className="animate-fade-in-up">
                <div className="section-header">
                  <h2 className="section-title">New Scans</h2>
                  <button className="see-all-link flex items-center gap-1">
                    See All <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {recentWines.map((wine) => (
                    <div
                      key={wine.id}
                      className="wine-list-item"
                      onClick={() => handleEdit(wine)}
                    >
                      <div className="wine-list-thumbnail">
                        {wine.label_image_url ? (
                          <Image
                            src={wine.label_image_url}
                            alt={wine.name}
                            width={48}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <WineIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{wine.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {wine.vintage && `${wine.vintage} • `}
                          {wine.region || wine.country || "Unknown region"}
                        </p>
                      </div>
                      {wine.score !== null && wine.score !== undefined && (
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-yellow-500">★</span>
                          <span className="font-medium">{wine.score.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Filters */}
            <WineFilters 
              wines={wines} 
              onFilterChange={setFilteredWines} 
            />
            
            {/* Active Wines Section */}
            {filteredActiveWines.length > 0 && (
              <section className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                <div className="section-header">
                  <h2 className="section-title">My Wines</h2>
                  <span className="text-sm text-muted-foreground">
                    {filteredActiveWines.length} {filteredActiveWines.length === 1 ? "wine" : "wines"}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
                  {filteredActiveWines.map((wine) => (
                    <WineCard 
                      key={wine.id} 
                      wine={wine} 
                      onDelete={handleDelete} 
                      onEdit={handleEdit}
                      onImageUpdate={fetchWines}
                      onQuantityUpdate={fetchWines}
                      isRanOut={false}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Ran Out Wines Section */}
            {filteredRanOutWines.length > 0 && (
              <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                <div className="section-header">
                  <h2 className="section-title text-muted-foreground">Ran Out</h2>
                  <span className="text-sm text-muted-foreground">
                    {filteredRanOutWines.length} {filteredRanOutWines.length === 1 ? "wine" : "wines"}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredRanOutWines.map((wine) => (
                    <WineCard 
                      key={wine.id} 
                      wine={wine} 
                      onDelete={handleDelete} 
                      onEdit={handleEdit}
                      onImageUpdate={fetchWines}
                      onQuantityUpdate={fetchWines}
                      isRanOut={true}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* No wines match filters */}
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
      
      <EditWineDialog
        wine={editingWine}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
