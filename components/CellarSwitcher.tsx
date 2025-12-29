"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Wine,
  ChevronDown,
  Plus,
  Users,
  Check,
  Loader2,
  Settings,
} from "lucide-react";
import { useCellar } from "@/components/CellarProvider";
import { cn } from "@/lib/utils";
import type { Cellar } from "@/types";

interface CellarSwitcherProps {
  className?: string;
  onSettingsClick?: (cellar: Cellar) => void;
}

export function CellarSwitcher({ className, onSettingsClick }: CellarSwitcherProps) {
  const {
    cellars,
    activeCellar,
    loading,
    setActiveCellar,
    createCellar,
  } = useCellar();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCellarName, setNewCellarName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateCellar = async () => {
    if (!newCellarName.trim()) return;
    
    setCreating(true);
    const cellar = await createCellar(newCellarName.trim());
    setCreating(false);
    
    if (cellar) {
      setActiveCellar(cellar);
      setCreateDialogOpen(false);
      setNewCellarName("");
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" className={cn("gap-2", className)} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </Button>
    );
  }

  if (!activeCellar) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "gap-2 max-w-[200px] justify-start font-normal p-0 h-auto",
              className
            )}
          >
            <span className="truncate font-medium">{activeCellar.name}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">Your Cellars</p>
            <p className="text-xs text-muted-foreground">
              {cellars.length} cellar{cellars.length !== 1 ? "s" : ""}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {cellars.map((cellar) => (
            <DropdownMenuItem
              key={cellar.id}
              onClick={() => setActiveCellar(cellar)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="flex-1 truncate">
                <div className="flex items-center gap-2">
                  <span className="truncate">{cellar.name}</span>
                  {cellar.is_shared && (
                    <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                </div>
                {cellar.member_count && cellar.member_count > 1 && (
                  <span className="text-xs text-muted-foreground">
                    {cellar.member_count} members
                  </span>
                )}
              </div>
              {cellar.id === activeCellar.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Cellar
          </DropdownMenuItem>
          
          {onSettingsClick && (
            <DropdownMenuItem
              onClick={() => onSettingsClick(activeCellar)}
              className="cursor-pointer"
            >
              <Settings className="h-4 w-4 mr-2" />
              Cellar Settings
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Cellar Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Cellar</DialogTitle>
            <DialogDescription>
              Create a new wine cellar. You can share it with family or friends later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cellar-name">Cellar Name</Label>
              <Input
                id="cellar-name"
                placeholder="e.g., Home Cellar, Beach House"
                value={newCellarName}
                onChange={(e) => setNewCellarName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating) {
                    handleCreateCellar();
                  }
                }}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewCellarName("");
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCellar}
              disabled={!newCellarName.trim() || creating}
              className="btn-wine"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Cellar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

