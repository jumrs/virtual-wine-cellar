"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { WineCard, type Wine } from "@/components/WineCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wine as WineIcon, ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { EditWineDialog } from "@/components/EditWineDialog";
import { BottomNav } from "@/components/BottomNav";

export default function SearchPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [wines, setWines] = useState<Wine[]>([]);
  const [loadingWines, setLoadingWines] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

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
      setWines(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load your wines.",
        variant: "destructive",
      });
    } finally {
      setLoadingWines(false);
    }
  };

  const filteredWines = useMemo(() => {
    if (!searchQuery.trim()) return wines;
    
    const query = searchQuery.toLowerCase();
    return wines.filter(
      (wine) =>
        wine.name.toLowerCase().includes(query) ||
        wine.type?.toLowerCase().includes(query) ||
        wine.grape?.toLowerCase().includes(query) ||
        wine.region?.toLowerCase().includes(query) ||
        wine.country?.toLowerCase().includes(query) ||
        wine.notes?.toLowerCase().includes(query)
    );
  }, [wines, searchQuery]);

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

      setWines((prevWines) => prevWines.filter((w) => w.id !== wineId));
      toast({
        title: "Success",
        description: "Wine removed from your cellar.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete wine.",
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
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <WineIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-muted-foreground">Loading wines...</p>
          </div>
        ) : searchQuery && filteredWines.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="font-semibold mb-2">No wines found</h3>
            <p className="text-muted-foreground">
              Try a different search term
            </p>
          </div>
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
          <div className="text-center py-16">
            <WineIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="font-semibold mb-2">Your cellar is empty</h3>
            <p className="text-muted-foreground mb-4">
              Add some wines to start searching
            </p>
            <Link href="/upload">
              <Button className="rounded-full btn-wine">
                Add Your First Wine
              </Button>
            </Link>
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

