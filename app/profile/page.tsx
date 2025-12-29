"use client";

import { useState, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wine as WineIcon,
  ArrowLeft,
  LogOut,
  User,
  Mail,
  Globe,
  Package,
  Star,
  Settings,
  HelpCircle,
  ChevronRight,
  Camera,
  Save,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { BottomNav } from "@/components/BottomNav";
import Image from "next/image";
import { StatBox } from "@/components/StatBox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuthGuard, useWines, getDisplayName } from "@/hooks";
import { calculateWineStats } from "@/lib/wineUtils";

// Lazy load analytics modals
const WinesAnalyticsModal = lazy(() =>
  import("@/components/analytics").then((m) => ({ default: m.WinesAnalyticsModal }))
);
const BottlesAnalyticsModal = lazy(() =>
  import("@/components/analytics").then((m) => ({ default: m.BottlesAnalyticsModal }))
);
const RatingAnalyticsModal = lazy(() =>
  import("@/components/analytics").then((m) => ({ default: m.RatingAnalyticsModal }))
);
const CountriesAnalyticsModal = lazy(() =>
  import("@/components/analytics").then((m) => ({ default: m.CountriesAnalyticsModal }))
);

export default function ProfilePage() {
  const { user, profile, loading: authLoading, signOut, refreshProfile } = useAuthGuard();
  const { wines, loading: loadingWines } = useWines({ autoFetch: !!user });
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    username: profile?.username || "",
    name: profile?.name || "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [winesModalOpen, setWinesModalOpen] = useState(false);
  const [bottlesModalOpen, setBottlesModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [countriesModalOpen, setCountriesModalOpen] = useState(false);

  // Update form when profile changes
  useMemo(() => {
    if (profile && !editing) {
      setFormData({
        username: profile.username || "",
        name: profile.name || "",
      });
    }
  }, [profile, editing]);

  // Calculate stats
  const stats = useMemo(() => calculateWineStats(wines), [wines]);

  const displayName = useMemo(
    () => getDisplayName(profile, user),
    [profile, user]
  );

  const handleSave = useCallback(async () => {
    if (!user) return;

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) throw new Error("Not authenticated");

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          username: formData.username.trim() || null,
          name: formData.name.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      await refreshProfile();
      setEditing(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [user, formData, refreshProfile, toast]);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      setUploadingAvatar(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) throw new Error("Not authenticated");

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/profile/avatar", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to upload avatar");
        }

        await refreshProfile();
        toast({
          title: "Avatar updated",
          description: "Your profile picture has been updated.",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to upload avatar.",
          variant: "destructive",
        });
      } finally {
        setUploadingAvatar(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [user, refreshProfile, toast]
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    router.push("/");
  }, [signOut, toast, router]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    if (profile) {
      setFormData({
        username: profile.username || "",
        name: profile.name || "",
      });
    }
  }, [profile]);

  if (authLoading) {
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
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full w-10 h-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold font-serif">Profile</h1>
            {editing && (
              <div className="ml-auto flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 page-container">
        {/* Profile Card */}
        <div className="wine-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div className="relative">
              {profile?.avatar_url ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                  <User className="w-10 h-10 text-primary" />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Your name"
                      className="elegant-input h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">
                      Username
                    </Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          username: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, ""),
                        })
                      }
                      placeholder="username"
                      className="elegant-input h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      3-20 characters, letters, numbers, and underscores only
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-semibold font-serif text-lg">{displayName}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {user.email}
                  </p>
                  {profile?.username && (
                    <p className="text-sm text-muted-foreground mt-1">
                      @{profile.username}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                    className="mt-3 rounded-xl"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatBox
              icon={<WineIcon className="w-4 h-4 text-primary" />}
              value={stats.totalWines}
              label="Wines"
              onClick={() => setWinesModalOpen(true)}
            />
            <StatBox
              icon={<Package className="w-4 h-4 text-primary" />}
              value={stats.totalBottles}
              label="Bottles"
              onClick={() => setBottlesModalOpen(true)}
            />
            <StatBox
              icon={<Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
              value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
              label="Avg Rating"
              onClick={() => setRatingModalOpen(true)}
            />
            <StatBox
              icon={<Globe className="w-4 h-4 text-primary" />}
              value={stats.uniqueCountries}
              label="Countries"
              onClick={() => setCountriesModalOpen(true)}
            />
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

      {/* Analytics Modals - Lazy loaded */}
      <Suspense fallback={null}>
        {winesModalOpen && (
          <WinesAnalyticsModal
            open={winesModalOpen}
            onOpenChange={setWinesModalOpen}
            wines={wines}
          />
        )}
        {bottlesModalOpen && (
          <BottlesAnalyticsModal
            open={bottlesModalOpen}
            onOpenChange={setBottlesModalOpen}
            wines={wines}
          />
        )}
        {ratingModalOpen && (
          <RatingAnalyticsModal
            open={ratingModalOpen}
            onOpenChange={setRatingModalOpen}
            wines={wines}
          />
        )}
        {countriesModalOpen && (
          <CountriesAnalyticsModal
            open={countriesModalOpen}
            onOpenChange={setCountriesModalOpen}
            wines={wines}
          />
        )}
      </Suspense>
    </div>
  );
}
