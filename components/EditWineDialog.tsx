"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save, Trash2, X, Star, MapPin, Wine, Calendar, Grape, Globe, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import type { Wine as WineType } from "./WineCard";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface EditWineDialogProps {
  wine: WineType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

// Star rating component for editing
function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          className="p-1 hover:scale-110 transition-transform"
        >
          <Star
            className={cn(
              "w-6 h-6 transition-colors",
              star <= value ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            )}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-lg font-semibold">{value.toFixed(1)}</span>
      )}
    </div>
  );
}

export function EditWineDialog({ wine, open, onOpenChange, onSave }: EditWineDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    grape: "",
    region: "",
    country: "",
    vintage: "",
    score: "",
    notes: "",
    quantity: 1,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (wine) {
      setFormData({
        name: wine.name || "",
        type: wine.type || "",
        grape: wine.grape || "",
        region: wine.region || "",
        country: wine.country || "",
        vintage: wine.vintage?.toString() || "",
        score: wine.score?.toString() || "",
        notes: wine.notes || "",
        quantity: wine.quantity || 1,
      });
    }
  }, [wine]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wine) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/wines?id=${wine.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type || null,
          grape: formData.grape || null,
          region: formData.region || null,
          country: formData.country || null,
          vintage: formData.vintage ? parseInt(formData.vintage) : null,
          score: formData.score ? parseFloat(formData.score) : null,
          notes: formData.notes || null,
          quantity: formData.quantity,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to update wine: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "Wine updated",
        description: "Changes have been saved.",
      });

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating wine:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update wine. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!wine) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/wines?id=${wine.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete wine");
      }

      toast({
        title: "Wine removed",
        description: "The wine has been removed from your cellar.",
      });

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete wine.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-3xl">
        {/* Wine Image Header */}
        {wine?.label_image_url ? (
          <div className="relative h-48 bg-gradient-to-b from-muted to-muted/50">
            <Image
              src={wine.label_image_url}
              alt={wine.name}
              fill
              className="object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-serif text-2xl">Edit Wine</DialogTitle>
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
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Wine Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-sm font-medium flex items-center gap-2">
              <Wine className="w-4 h-4 text-muted-foreground" />
              Wine Name
            </Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Château Margaux"
              className="elegant-input h-11"
            />
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              Rating
            </Label>
            <StarRatingInput
              value={parseFloat(formData.score) || 0}
              onChange={(v) => setFormData({ ...formData, score: v.toString() })}
            />
          </div>

          {/* Wine Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type" className="text-sm font-medium">Type</Label>
              <Input
                id="edit-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                placeholder="e.g., Red"
                className="elegant-input h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-vintage" className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                Vintage
              </Label>
              <Input
                id="edit-vintage"
                type="number"
                value={formData.vintage}
                onChange={(e) => setFormData({ ...formData, vintage: e.target.value })}
                placeholder="e.g., 2019"
                min="1900"
                max={new Date().getFullYear() + 1}
                className="elegant-input h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-grape" className="text-sm font-medium flex items-center gap-1">
                <Grape className="w-3 h-3 text-muted-foreground" />
                Grape
              </Label>
              <Input
                id="edit-grape"
                value={formData.grape}
                onChange={(e) => setFormData({ ...formData, grape: e.target.value })}
                placeholder="e.g., Cabernet"
                className="elegant-input h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-region" className="text-sm font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                Region
              </Label>
              <Input
                id="edit-region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., Bordeaux"
                className="elegant-input h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-country" className="text-sm font-medium flex items-center gap-1">
                <Globe className="w-3 h-3 text-muted-foreground" />
                Country
              </Label>
              <Input
                id="edit-country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="e.g., France"
                className="elegant-input h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-quantity" className="text-sm font-medium flex items-center gap-1">
                <Package className="w-3 h-3 text-muted-foreground" />
                Bottles
              </Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                required
                className="elegant-input h-10"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-notes" className="text-sm font-medium">Tasting Notes</Label>
            <textarea
              id="edit-notes"
              className="elegant-input w-full min-h-[80px] rounded-xl resize-none"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Your tasting notes..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="rounded-xl h-11 px-4 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
            <Button 
              type="submit" 
              disabled={saving || deleting}
              className="flex-1 rounded-xl h-11 btn-wine"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
