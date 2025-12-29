/**
 * Real-time Subscriptions for Cellar Changes
 * Enables live sync of wine data across all cellar members
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { invalidateWineCache } from "@/hooks/useWines";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseCellarRealtimeOptions {
  /** Cellar ID to subscribe to */
  cellarId: string | null | undefined;
  /** Callback when wines change */
  onWinesChange?: () => void;
  /** Callback when members change */
  onMembersChange?: () => void;
  /** Whether to show toast notifications for changes */
  showNotifications?: boolean;
}

/**
 * Hook to subscribe to real-time changes in a cellar
 */
export function useCellarRealtime({
  cellarId,
  onWinesChange,
  onMembersChange,
  showNotifications = true,
}: UseCellarRealtimeOptions) {
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef({ onWinesChange, onMembersChange });

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = { onWinesChange, onMembersChange };
  }, [onWinesChange, onMembersChange]);

  const handleWineChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      // Invalidate cache for this cellar
      if (cellarId) {
        invalidateWineCache(cellarId);
      }

      // Show notification
      if (showNotifications) {
        switch (eventType) {
          case "INSERT":
            toast({
              title: "Wine added",
              description: `"${newRecord?.name || "A wine"}" was added to the cellar.`,
            });
            break;
          case "UPDATE":
            // Only notify if significant changes (not just quantity)
            if (newRecord?.name !== oldRecord?.name) {
              toast({
                title: "Wine updated",
                description: `"${newRecord?.name || "A wine"}" was updated.`,
              });
            }
            break;
          case "DELETE":
            toast({
              title: "Wine removed",
              description: `A wine was removed from the cellar.`,
            });
            break;
        }
      }

      // Trigger callback
      callbacksRef.current.onWinesChange?.();
    },
    [cellarId, showNotifications, toast]
  );

  const handleMemberChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRecord } = payload;

      // Show notification
      if (showNotifications) {
        switch (eventType) {
          case "INSERT":
            toast({
              title: "New member",
              description: "Someone joined the cellar.",
            });
            break;
          case "DELETE":
            toast({
              title: "Member left",
              description: "Someone left the cellar.",
            });
            break;
        }
      }

      // Trigger callback
      callbacksRef.current.onMembersChange?.();
    },
    [showNotifications, toast]
  );

  useEffect(() => {
    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Don't subscribe if no cellar ID
    if (!cellarId) {
      return;
    }

    // Create new subscription with error handling
    try {
      const channel = supabase
        .channel(`cellar:${cellarId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wines",
            filter: `cellar_id=eq.${cellarId}`,
          },
          handleWineChange
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cellar_members",
            filter: `cellar_id=eq.${cellarId}`,
          },
          handleMemberChange
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log(`Subscribed to cellar ${cellarId} changes`);
          } else if (status === "CHANNEL_ERROR") {
            // Log but don't show error to user - realtime is a nice-to-have
            console.warn(`Realtime subscription error for cellar ${cellarId}:`, err);
          } else if (status === "TIMED_OUT") {
            console.warn(`Realtime subscription timed out for cellar ${cellarId}`);
          }
        });

      channelRef.current = channel;
    } catch (err) {
      // Silently fail - realtime is optional
      console.warn("Failed to set up realtime subscription:", err);
    }

    // Cleanup on unmount or cellar change
    return () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          // Ignore cleanup errors
        }
        channelRef.current = null;
      }
    };
  }, [cellarId, handleWineChange, handleMemberChange]);

  // Return unsubscribe function for manual control
  return {
    unsubscribe: () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    },
  };
}

