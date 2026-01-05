"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  X,
  Shield,
  UserCircle,
  Settings,
  LogOut,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCellar } from "@/components/CellarProvider";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { cn } from "@/lib/utils";
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
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(cellar.name);
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = cellar.owner_id === user?.id;
  const currentUserMember = members.find((m) => m.user_id === user?.id);
  const isAdmin = currentUserMember?.role === "admin";
  const canManageMembers = isOwner || isAdmin;

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

  const handleUpdateRole = async (userId: string, newRole: "admin" | "member") => {
    setUpdatingRoleUserId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/cellars/members", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cellarId: cellar.id,
          userId,
          role: newRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update role");
      }

      toast({
        title: "Role updated",
        description: `Member role changed to ${newRole}.`,
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoleUserId(null);
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

  const getMemberDisplayName = (member: CellarMember) => {
    if (member.user?.name) return member.user.name;
    if (member.user?.username) return member.user.username;
    if (member.user?.email) return member.user.email.split('@')[0];
    return "Unknown User";
  };

  const getMemberInitial = (member: CellarMember) => {
    const name = getMemberDisplayName(member);
    return name[0]?.toUpperCase() || "?";
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Crown className="h-3 w-3" />
            Owner
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Shield className="h-3 w-3" />
            Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            <UserCircle className="h-3 w-3" />
            Member
          </span>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-3xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-serif text-2xl flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              Cellar Settings
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Cellar Name */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Crown className="w-4 h-4 text-muted-foreground" />
              Cellar Name
            </Label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={savingName}
                  maxLength={100}
                  className="elegant-input h-11 rounded-xl"
                />
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={savingName || !newName.trim()}
                  className="rounded-xl h-11 px-4"
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
                  className="rounded-xl h-11"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                <span className="font-medium text-lg">{cellar.name}</span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingName(true)}
                    className="rounded-lg h-8 text-xs"
                  >
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Members
              {members.length > 0 && (
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {members.length}
                </span>
              )}
            </Label>
            <div className="bg-muted/30 rounded-2xl overflow-hidden">
              {loadingMembers ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  <span className="text-sm">Loading members...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <span className="text-sm">No members yet</span>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      {/* Avatar */}
                      {member.user?.avatar_url ? (
                        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                          <Image
                            src={member.user.avatar_url}
                            alt={getMemberDisplayName(member)}
                            width={44}
                            height={44}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-base font-semibold text-primary">
                            {getMemberInitial(member)}
                          </span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {getMemberDisplayName(member)}
                          </span>
                          {member.user_id === user?.id && (
                            <span className="text-xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getRoleBadge(member.role)}
                        </div>
                      </div>

                      {/* Actions */}
                      {member.role !== "owner" && member.user_id !== user?.id && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Role Select - only for owner */}
                          {isOwner && (
                            <Select
                              value={member.role}
                              onValueChange={(value) => handleUpdateRole(member.user_id, value as "admin" | "member")}
                              disabled={updatingRoleUserId === member.user_id}
                            >
                              <SelectTrigger className="w-[110px] h-9 rounded-lg text-xs">
                                {updatingRoleUserId === member.user_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-3 w-3 text-blue-500" />
                                    Admin
                                  </div>
                                </SelectItem>
                                <SelectItem value="member">
                                  <div className="flex items-center gap-2">
                                    <UserCircle className="h-3 w-3" />
                                    Member
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          {/* Remove Button */}
                          {(isOwner || (isAdmin && member.role === "member")) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Invite Section */}
          {canManageMembers && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                Invite Member
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="elegant-input h-11 pl-10 rounded-xl"
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
                  className="rounded-xl h-11 px-5"
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
                The user will receive an invitation they can accept or decline.
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t bg-muted/30 space-y-3">
          {isOwner ? (
            <>
              {confirmDelete ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                  <p className="text-sm text-destructive mb-3 flex items-start gap-2">
                    <Trash2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    This will permanently delete the cellar and all its wines. This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteCellar}
                      disabled={deleting}
                      className="rounded-xl flex-1"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Yes, Delete"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded-xl flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-11 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Cellar
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-xl h-11 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={handleLeaveCellar}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave Cellar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
