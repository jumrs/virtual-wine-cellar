"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ChevronRight,
  Camera,
  Save,
  Loader2,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { BottomNav } from "@/components/BottomNav";
import Image from "next/image";
import type { Wine } from "@/components/WineCard";

export default function ProfilePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [wines, setWines] = useState<Wine[]>([]);
  const [loadingWines, setLoadingWines] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    name: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || "",
        name: profile.name || "",
      });
    }
  }, [profile]);

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

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

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
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

  const displayName = profile?.name || profile?.username || (user.email?.split("@")[0] || "User");

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
                  onClick={() => {
                    setEditing(false);
                    if (profile) {
                      setFormData({
                        username: profile.username || "",
                        name: profile.name || "",
                      });
                    }
                  }}
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
              {editing && (
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
              )}
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
                    <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your name"
                      className="elegant-input h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                      placeholder="username"
                      className="elegant-input h-10"
                    />
                    <p className="text-xs text-muted-foreground">3-20 characters, letters, numbers, and underscores only</p>
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
                    <p className="text-sm text-muted-foreground mt-1">@{profile.username}</p>
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
