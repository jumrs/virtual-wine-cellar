"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { WineCard, type Wine } from "@/components/WineCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LogIn, Wine as WineIcon } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { ConfigCheck } from "@/components/ConfigCheck";
import { EditWineDialog } from "@/components/EditWineDialog";
import { WineFilters } from "@/components/WineFilters";

// Sort wines: by country (alphabetically), then by name (alphabetically) within each country
function sortWinesByCountryAndName(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
    // Handle wines without country - put them at the end
    const countryA = a.country || "ZZZ_No Country";
    const countryB = b.country || "ZZZ_No Country";
    
    // First sort by country
    if (countryA !== countryB) {
      return countryA.localeCompare(countryB);
    }
    
    // If same country, sort by name
    return (a.name || "").localeCompare(b.name || "");
  });
}

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const [wines, setWines] = useState<Wine[]>([]);
  const [filteredWines, setFilteredWines] = useState<Wine[]>([]);
  const [loadingWines, setLoadingWines] = useState(false);
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

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
      
      // Sort wines: by country (alphabetically), then by name (alphabetically) within each country
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
    fetchWines(); // Refresh the wines list (fetchWines already sorts them)
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
        // Re-sort after deletion
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <WineIcon className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-purple-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <WineIcon className="h-16 w-16 mx-auto mb-4 text-primary" />
            <CardTitle className="text-3xl">Virtual Wine Cellar</CardTitle>
            <CardDescription>
              Manage your wine collection with AI-powered label recognition
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/auth" className="block">
              <Button className="w-full" size="lg">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In / Sign Up
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-purple-50">
      <ConfigCheck />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Wine Cellar</h1>
            <p className="text-muted-foreground">
              Welcome back, {user.email}
            </p>
            {wines.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {filteredWines.length} of {wines.length} {wines.length === 1 ? "wine" : "wines"} • {wines.reduce((sum, wine) => sum + (wine.quantity || 1), 0)} total bottles
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/upload">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Wine
              </Button>
            </Link>
            <Link href="/pairings">
              <Button variant="outline">
                <WineIcon className="h-4 w-4 mr-2" />
                Pairings
              </Button>
            </Link>
            <Button variant="ghost" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {loadingWines ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your wines...</p>
          </div>
        ) : wines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <WineIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Your cellar is empty</h3>
              <p className="text-muted-foreground mb-4">
                Start building your collection by adding your first wine!
              </p>
              <Link href="/upload">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Wine
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <WineFilters 
              wines={wines} 
              onFilterChange={setFilteredWines} 
            />
            {filteredWines.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No wines match your filters. Try adjusting your search criteria.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWines.map((wine) => (
                  <WineCard 
                    key={wine.id} 
                    wine={wine} 
                    onDelete={handleDelete} 
                    onEdit={handleEdit}
                    onImageUpdate={fetchWines}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <EditWineDialog
        wine={editingWine}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveEdit}
      />
    </div>
  );
}

