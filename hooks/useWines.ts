/**
 * Wine Data Hook
 * Centralized wine fetching with caching and optimized re-fetching
 * Supports both legacy user-based and new cellar-based data access
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { sortWinesByCountryAndName } from "@/lib/wineUtils";
import type { Wine } from "@/types";

interface UseWinesOptions {
  /** Whether to fetch wines on mount (default: true) */
  autoFetch?: boolean;
  /** Sort wines by country and name (default: true) */
  sortOnFetch?: boolean;
  /** Show toast on error (default: true) */
  showErrorToast?: boolean;
  /** Cellar ID to fetch wines for (optional - uses legacy user_wines if not provided) */
  cellarId?: string | null;
}

interface UseWinesReturn {
  /** Array of wines */
  wines: Wine[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Fetch/refresh wines from API */
  fetchWines: () => Promise<void>;
  /** Update wines locally (for optimistic updates) */
  setWines: React.Dispatch<React.SetStateAction<Wine[]>>;
  /** Delete a wine by ID */
  deleteWine: (wineId: string) => Promise<boolean>;
  /** Update wine quantity */
  updateQuantity: (wineId: string, quantity: number) => Promise<boolean>;
}

/**
 * Cache for wine data to prevent redundant fetches.
 * IMPORTANT: Cache must be scoped per-user/cellar to avoid leaking data across account/cellar switches.
 */
let wineCache: Record<string, Wine[] | undefined> = {};
let lastFetchTime: Record<string, number | undefined> = {};
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Generate cache key based on user and cellar
 */
function getCacheKey(userId: string, cellarId?: string | null): string {
  return cellarId ? `${userId}:${cellarId}` : userId;
}

/**
 * Custom hook for managing wine data
 * Provides fetching, caching, and common operations
 */
export function useWines(options: UseWinesOptions = {}): UseWinesReturn {
  const {
    autoFetch = true,
    sortOnFetch = true,
    showErrorToast = true,
    cellarId,
  } = options;

  // Start empty; we'll hydrate from the correct per-user cache after we know who is logged in.
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const mountedRef = useRef(true);
  const cellarIdRef = useRef(cellarId);

  // Update ref when cellarId changes
  useEffect(() => {
    cellarIdRef.current = cellarId;
  }, [cellarId]);

  const fetchWines = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const userId = session?.user?.id;

      if (!accessToken || !userId) {
        // No session - clear wines and return empty
        setWines([]);
        setLoading(false);
        return;
      }

      const currentCellarId = cellarIdRef.current;
      const cacheKey = getCacheKey(userId, currentCellarId);

      // Use cache if available and fresh (unless force refresh)
      const now = Date.now();
      const cachedWines = wineCache[cacheKey];
      const cachedTime = lastFetchTime[cacheKey] ?? 0;
      if (!forceRefresh && cachedWines && now - cachedTime < CACHE_DURATION) {
        if (mountedRef.current) {
          setWines(cachedWines);
          setLoading(false);
        }
        return;
      }

      // Build URL with cellar ID if provided
      const url = currentCellarId 
        ? `/api/wines?cellarId=${currentCellarId}`
        : "/api/wines";

      const response = await fetch(url, {
        // Prevent browser/proxy caches from reusing a previous user's response.
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch wines");
      }

      const data = await response.json();
      const processedWines = sortOnFetch ? sortWinesByCountryAndName(data) : data;

      // Update cache
      wineCache[cacheKey] = processedWines;
      lastFetchTime[cacheKey] = Date.now();

      if (mountedRef.current) {
        setWines(processedWines);
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load wines";
      if (mountedRef.current) {
        setError(errorMessage);
        if (showErrorToast) {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [sortOnFetch, showErrorToast, toast]);

  const deleteWine = useCallback(async (wineId: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const userId = session?.user?.id;

      if (!accessToken || !userId) {
        throw new Error("Not authenticated");
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

      const currentCellarId = cellarIdRef.current;
      const cacheKey = getCacheKey(userId, currentCellarId);

      // Optimistic update
      setWines((prev) => {
        const updated = prev.filter((w) => w.id !== wineId);
        const next = sortWinesByCountryAndName(updated);
        wineCache[cacheKey] = next;
        lastFetchTime[cacheKey] = Date.now();
        return next;
      });

      toast({
        title: "Success",
        description: "Wine removed from the cellar.",
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete wine.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const updateQuantity = useCallback(async (wineId: string, quantity: number): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const userId = session?.user?.id;

      if (!accessToken || !userId) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/wines/quantity", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wineId, quantity }),
      });

      if (!response.ok) {
        throw new Error("Failed to update quantity");
      }

      const currentCellarId = cellarIdRef.current;
      const cacheKey = getCacheKey(userId, currentCellarId);

      // Optimistic update
      setWines((prev) => {
        const updated = prev.map((w) =>
          w.id === wineId ? { ...w, quantity } : w
        );
        const next = sortWinesByCountryAndName(updated);
        wineCache[cacheKey] = next;
        lastFetchTime[cacheKey] = Date.now();
        return next;
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update quantity.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Refetch when cellarId changes
  useEffect(() => {
    mountedRef.current = true;
    if (autoFetch) {
      void fetchWines(true); // Force refresh on cellar change
    }
    return () => {
      mountedRef.current = false;
    };
  }, [autoFetch, cellarId]); // Include cellarId to refetch on change

  return {
    wines,
    loading,
    error,
    fetchWines: () => fetchWines(true), // Force refresh when called manually
    setWines,
    deleteWine,
    updateQuantity,
  };
}

/**
 * Invalidate the wine cache (call after mutations)
 * @param cellarId - Optional cellar ID to invalidate specific cache, or all if not provided
 */
export function invalidateWineCache(cellarId?: string): void {
  if (cellarId) {
    // Invalidate specific cellar caches
    Object.keys(wineCache).forEach((key) => {
      if (key.includes(cellarId)) {
        delete wineCache[key];
        delete lastFetchTime[key];
      }
    });
  } else {
    // Invalidate all caches
    wineCache = {};
    lastFetchTime = {};
  }
}

