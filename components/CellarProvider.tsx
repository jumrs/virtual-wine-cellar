"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import type { Cellar, CellarContextState } from "@/types";

const ACTIVE_CELLAR_KEY = "activeCellarId";

interface CellarProviderProps {
  children: React.ReactNode;
}

const CellarContext = createContext<CellarContextState>({
  cellars: [],
  activeCellar: null,
  loading: true,
  error: null,
  setActiveCellar: () => {},
  refreshCellars: async () => {},
  createCellar: async () => null,
  deleteCellar: async () => false,
  renameCellar: async () => false,
  inviteUser: async () => false,
  removeMember: async () => false,
  leaveCellar: async () => false,
});

export function CellarProvider({ children }: CellarProviderProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [cellars, setCellars] = useState<Cellar[]>([]);
  const [activeCellar, setActiveCellarState] = useState<Cellar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Get access token helper
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  // Fetch cellars from API
  const fetchCellars = useCallback(async () => {
    if (!user) {
      setCellars([]);
      setActiveCellarState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/cellars", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch cellars");
      }

      const data = await response.json();

      if (!mountedRef.current) return;

      setCellars(data);

      // Restore active cellar from localStorage or use first cellar
      const savedCellarId = localStorage.getItem(ACTIVE_CELLAR_KEY);
      const savedCellar = savedCellarId
        ? data.find((c: Cellar) => c.id === savedCellarId)
        : null;

      if (savedCellar) {
        setActiveCellarState(savedCellar);
      } else if (data.length > 0) {
        setActiveCellarState(data[0]);
        localStorage.setItem(ACTIVE_CELLAR_KEY, data[0].id);
      }

      // If user has no cellars, create a default one
      if (data.length === 0 && user) {
        await createDefaultCellar();
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message);
        console.error("Failed to fetch cellars:", err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [user, getAccessToken]);

  // Create default cellar for new users
  const createDefaultCellar = useCallback(async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const displayName = profile?.name || profile?.username || user?.email?.split("@")[0] || "My";
      const cellarName = `${displayName}'s Cellar`;

      const response = await fetch("/api/cellars", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: cellarName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create default cellar");
      }

      const { cellar } = await response.json();

      if (mountedRef.current) {
        setCellars([cellar]);
        setActiveCellarState(cellar);
        localStorage.setItem(ACTIVE_CELLAR_KEY, cellar.id);
      }
    } catch (err) {
      console.error("Failed to create default cellar:", err);
    }
  }, [getAccessToken, profile, user]);

  // Set active cellar
  const setActiveCellar = useCallback((cellar: Cellar) => {
    setActiveCellarState(cellar);
    localStorage.setItem(ACTIVE_CELLAR_KEY, cellar.id);
  }, []);

  // Create a new cellar
  const createCellar = useCallback(
    async (name: string): Promise<Cellar | null> => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch("/api/cellars", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create cellar");
        }

        const { cellar } = await response.json();

        setCellars((prev) => [...prev, cellar]);
        
        toast({
          title: "Cellar created",
          description: `"${cellar.name}" has been created.`,
        });

        return cellar;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to create cellar",
          variant: "destructive",
        });
        return null;
      }
    },
    [getAccessToken, toast]
  );

  // Delete a cellar
  const deleteCellar = useCallback(
    async (cellarId: string): Promise<boolean> => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch(`/api/cellars?id=${cellarId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete cellar");
        }

        // Update state
        setCellars((prev) => {
          const newCellars = prev.filter((c) => c.id !== cellarId);
          
          // If we deleted the active cellar, switch to another one
          if (activeCellar?.id === cellarId && newCellars.length > 0) {
            setActiveCellarState(newCellars[0]);
            localStorage.setItem(ACTIVE_CELLAR_KEY, newCellars[0].id);
          }
          
          return newCellars;
        });

        toast({
          title: "Cellar deleted",
          description: "The cellar has been removed.",
        });

        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to delete cellar",
          variant: "destructive",
        });
        return false;
      }
    },
    [getAccessToken, toast, activeCellar]
  );

  // Rename a cellar
  const renameCellar = useCallback(
    async (cellarId: string, newName: string): Promise<boolean> => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch(`/api/cellars?id=${cellarId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: newName }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to rename cellar");
        }

        const { cellar } = await response.json();

        // Update state
        setCellars((prev) =>
          prev.map((c) => (c.id === cellarId ? { ...c, ...cellar } : c))
        );

        if (activeCellar?.id === cellarId) {
          setActiveCellarState((prev) => (prev ? { ...prev, ...cellar } : prev));
        }

        toast({
          title: "Cellar renamed",
          description: `Cellar renamed to "${newName}".`,
        });

        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to rename cellar",
          variant: "destructive",
        });
        return false;
      }
    },
    [getAccessToken, toast, activeCellar]
  );

  // Invite user to cellar
  const inviteUser = useCallback(
    async (cellarId: string, email: string): Promise<boolean> => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch("/api/cellars/invite", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cellarId, email }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to invite user");
        }

        const data = await response.json();

        // Update member count if user was added directly
        if (data.type === "added") {
          setCellars((prev) =>
            prev.map((c) =>
              c.id === cellarId
                ? { ...c, member_count: (c.member_count || 1) + 1, is_shared: true }
                : c
            )
          );
          if (activeCellar?.id === cellarId) {
            setActiveCellarState((prev) =>
              prev
                ? { ...prev, member_count: (prev.member_count || 1) + 1, is_shared: true }
                : prev
            );
          }
        }

        toast({
          title: data.type === "added" ? "Member added" : "Invite sent",
          description: data.message,
        });

        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to invite user",
          variant: "destructive",
        });
        return false;
      }
    },
    [getAccessToken, toast, activeCellar]
  );

  // Remove member from cellar
  const removeMember = useCallback(
    async (cellarId: string, userId: string): Promise<boolean> => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch(
          `/api/cellars/members?cellarId=${cellarId}&userId=${userId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to remove member");
        }

        // Update member count
        setCellars((prev) =>
          prev.map((c) =>
            c.id === cellarId
              ? {
                  ...c,
                  member_count: Math.max(1, (c.member_count || 1) - 1),
                  is_shared: (c.member_count || 1) - 1 > 1,
                }
              : c
          )
        );

        if (activeCellar?.id === cellarId) {
          setActiveCellarState((prev) =>
            prev
              ? {
                  ...prev,
                  member_count: Math.max(1, (prev.member_count || 1) - 1),
                  is_shared: (prev.member_count || 1) - 1 > 1,
                }
              : prev
          );
        }

        toast({
          title: "Member removed",
          description: "The member has been removed from the cellar.",
        });

        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to remove member",
          variant: "destructive",
        });
        return false;
      }
    },
    [getAccessToken, toast, activeCellar]
  );

  // Leave a cellar (for non-owners)
  const leaveCellar = useCallback(
    async (cellarId: string): Promise<boolean> => {
      if (!user) return false;
      
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch(
          `/api/cellars/members?cellarId=${cellarId}&userId=${user.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to leave cellar");
        }

        // Remove cellar from list
        setCellars((prev) => {
          const newCellars = prev.filter((c) => c.id !== cellarId);
          
          // If we left the active cellar, switch to another one
          if (activeCellar?.id === cellarId && newCellars.length > 0) {
            setActiveCellarState(newCellars[0]);
            localStorage.setItem(ACTIVE_CELLAR_KEY, newCellars[0].id);
          }
          
          return newCellars;
        });

        toast({
          title: "Left cellar",
          description: "You have left the cellar.",
        });

        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to leave cellar",
          variant: "destructive",
        });
        return false;
      }
    },
    [getAccessToken, toast, user, activeCellar]
  );

  // Initial fetch when user changes
  useEffect(() => {
    mountedRef.current = true;
    fetchCellars();
    return () => {
      mountedRef.current = false;
    };
  }, [user?.id]);

  // Clear state on logout
  useEffect(() => {
    if (!user) {
      setCellars([]);
      setActiveCellarState(null);
      localStorage.removeItem(ACTIVE_CELLAR_KEY);
    }
  }, [user]);

  const contextValue = useMemo<CellarContextState>(
    () => ({
      cellars,
      activeCellar,
      loading,
      error,
      setActiveCellar,
      refreshCellars: fetchCellars,
      createCellar,
      deleteCellar,
      renameCellar,
      inviteUser,
      removeMember,
      leaveCellar,
    }),
    [
      cellars,
      activeCellar,
      loading,
      error,
      setActiveCellar,
      fetchCellars,
      createCellar,
      deleteCellar,
      renameCellar,
      inviteUser,
      removeMember,
      leaveCellar,
    ]
  );

  return (
    <CellarContext.Provider value={contextValue}>
      {children}
    </CellarContext.Provider>
  );
}

export function useCellar() {
  const context = useContext(CellarContext);
  if (!context) {
    throw new Error("useCellar must be used within a CellarProvider");
  }
  return context;
}

