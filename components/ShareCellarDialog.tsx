"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  UserPlus,
  Loader2,
  Mail,
  Crown,
  Trash2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { useCellar } from "@/components/CellarProvider";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import type { Cellar, CellarMember } from "@/types";

interface ShareCellarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cellar: Cellar;
}

export function ShareCellarDialog({
  open,
  onOpenChange,
  cellar,
}: ShareCellarDialogProps) {
  const { user } = useAuth();
  const { inviteUser, removeMember, renameCellar, deleteCellar, leaveCellar, refreshCellars } =
    useCellar();
  const { toast } = useToast();

  const [members, setMembers] = useState<CellarMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(cellar.name);
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = cellar.owner_id === user?.id;

  // Fetch members when dialog opens
  const fetchMembers = useCallback(async () => {
    if (!open) return;

    setLoadingMembers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) return;

      const response = await fetch(`/api/cellars/members?cellarId=${cellar.id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setLoadingMembers(false);
    }
  }, [open, cellar.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setInviteEmail("");
      setEditingName(false);
      setNewName(cellar.name);
      setConfirmDelete(false);
    }
  }, [open, cellar.name]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    const success = await inviteUser(cellar.id, inviteEmail.trim());
    setInviting(false);

    if (success) {
      setInviteEmail("");
      fetchMembers();
      refreshCellars();
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingUserId(userId);
    const success = await removeMember(cellar.id, userId);
    setRemovingUserId(null);

    if (success) {
      fetchMembers();
      refreshCellars();
    }
  };

  const handleLeaveCellar = async () => {
    const success = await leaveCellar(cellar.id);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName === cellar.name) {
      setEditingName(false);
      return;
    }

    setSavingName(true);
    const success = await renameCellar(cellar.id, newName.trim());
    setSavingName(false);

    if (success) {
      setEditingName(false);
    }
  };

  const handleDeleteCellar = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    const success = await deleteCellar(cellar.id);
    setDeleting(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const copyShareLink = () => {
    // In a real implementation, this would generate an invite link
    const shareText = `Join my wine cellar "${cellar.name}"`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Share text copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Cellar Settings
          </DialogTitle>
          <DialogDescription>
            Manage your cellar and share it with others.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cellar Name */}
          <div className="space-y-2">
            <Label>Cellar Name</Label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={savingName}
                  maxLength={100}
                />
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={savingName || !newName.trim()}
                >
                  {savingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingName(false);
                    setNewName(cellar.name);
                  }}
                  disabled={savingName}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium">{cellar.name}</span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingName(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Members List */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Members
              {members.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({members.length})
                </span>
              )}
            </Label>
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {loadingMembers ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No members yet
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3"
                  >
                    {/* Avatar */}
                    {member.user?.avatar_url ? (
                      <Image
                        src={member.user.avatar_url}
                        alt={member.user.name || "User"}
                        width={36}
                        height={36}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {(member.user?.name || member.user?.email || "?")[0].toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {member.user?.name || member.user?.username || member.user?.email || "Unknown"}
                        </span>
                        {member.role === "owner" && (
                          <Crown className="h-3 w-3 text-yellow-500" />
                        )}
                        {member.user_id === user?.id && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                      {member.user?.email && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {member.user.email}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {isOwner && member.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={removingUserId === member.user_id}
                      >
                        {removingUserId === member.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invite Section */}
          {isOwner && (
            <div className="space-y-2">
              <Label htmlFor="invite-email">Invite Member</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !inviting) {
                        handleInvite();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                >
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                If the user already has an account, they'll be added immediately.
                Otherwise, they'll receive an invite when they sign up.
              </p>
            </div>
          )}

          {/* Share Link */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareLink}
              className="gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy Share Text
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Leave / Delete */}
          {isOwner ? (
            <div className="flex-1">
              {confirmDelete ? (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>This will delete all wines in this cellar. Are you sure?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteCellar}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Delete"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Cellar
                </Button>
              )}
            </div>
          ) : (
            <div className="flex-1">
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLeaveCellar}
              >
                Leave Cellar
              </Button>
            </div>
          )}

          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

