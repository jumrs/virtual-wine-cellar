"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { 
  Wine as WineIcon, 
  ArrowLeft, 
  LogOut, 
  User, 
  Mail, 
  Calendar,
  Package,
  Star,
  Settings,
  HelpCircle,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { BottomNav } from "@/components/BottomNav";
import type { Wine } from "@/components/WineCard";

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [wines, setWines] = useState<Wine[]>([]);
  const [loadingWines, setLoadingWines] = useState(false);
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

      if (!accessToken) return;

      const response = await fetch("/api/wines", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWines(data);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setLoadingWines(false);
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

  // Calculate stats
  const totalWines = wines.length;
  const totalBottles = wines.reduce((sum, w) => sum + (w.quantity || 0), 0);
  const avgRating = wines.filter(w => w.score).length > 0
    ? wines.filter(w => w.score).reduce((sum, w) => sum + (w.score || 0), 0) / wines.filter(w => w.score).length
    : 0;
  const uniqueCountries = new Set(wines.map(w => w.country).filter(Boolean)).size;

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    router.push("/");
  };

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
            <h1 className="text-xl font-semibold font-serif">Profile</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 page-container">
        {/* Profile Card */}
        <div className="wine-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold font-serif text-lg">Wine Enthusiast</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {user.email}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <WineIcon className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{totalWines}</span>
              </div>
              <p className="text-xs text-muted-foreground">Wines</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{totalBottles}</span>
              </div>
              <p className="text-xs text-muted-foreground">Bottles</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-2xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</span>
              </div>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{uniqueCountries}</span>
              </div>
              <p className="text-xs text-muted-foreground">Countries</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="wine-card divide-y divide-border/50">
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <span>Settings</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
              <span>Help & Support</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-destructive"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </div>
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          My Cellar v1.0.0
        </p>
      </main>

      <BottomNav />
    </div>
  );
}

