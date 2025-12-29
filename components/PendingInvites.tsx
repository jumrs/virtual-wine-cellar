"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Wine,
  Users,
  Check,
  X,
  Loader2,
  Clock,
  Mail,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useCellar } from "@/components/CellarProvider";
import Image from "next/image";

interface Invite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  created_at: string;
  cellar: {
    id: string;
    name: string;
    owner_id: string;
  } | null;
  inviter: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface PendingInvitesProps {
  onInviteAccepted?: () => void;
}

export function PendingInvites({ onInviteAccepted }: PendingInvitesProps) {
  const { toast } = useToast();
  const { refreshCellars } = useCellar();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/cellars/invites", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        setInvites(data);
      }
    } catch (error) {
      console.error("Failed to fetch invites:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleAccept = async (invite: Invite) => {
    setProcessingId(invite.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/cellars/invite", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: invite.token }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept invite");
      }

      const data = await response.json();

      toast({
        title: "Invite accepted!",
        description: data.message || `You've joined "${invite.cellar?.name}"`,
      });

      // Remove from list
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));

      // Refresh cellars to show the new one
      await refreshCellars();
      onInviteAccepted?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invite",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invite: Invite) => {
    setProcessingId(invite.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      // Use the decline endpoint for invited users
      const response = await fetch(`/api/cellars/invites/decline?id=${invite.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to decline invite");
      }

      // Remove from list
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));

      toast({
        title: "Invite declined",
        description: "You've declined the cellar invitation.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to decline invite",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return null;
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {invites.map((invite) => (
        <Card key={invite.id} className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  Cellar Invitation
                </CardTitle>
                <CardDescription className="mt-1">
                  {invite.inviter?.name || invite.inviter?.email || "Someone"} invited you to join
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3 mb-4 p-3 bg-background rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Wine className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {invite.cellar?.name || "Wine Cellar"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleDecline(invite)}
                disabled={processingId === invite.id}
              >
                {processingId === invite.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </>
                )}
              </Button>
              <Button
                size="sm"
                className="flex-1 btn-wine"
                onClick={() => handleAccept(invite)}
                disabled={processingId === invite.id}
              >
                {processingId === invite.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

