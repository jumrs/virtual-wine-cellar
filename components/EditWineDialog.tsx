"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import type { Wine } from "./WineCard";

interface EditWineDialogProps {
  wine: Wine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
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
  const { toast } = useToast();

  // Update form data when wine changes
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
        title: "Success",
        description: "Wine updated successfully!",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Wine</DialogTitle>
          <DialogDescription>
            Update the wine information below. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Wine Name *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Château Margaux"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-type">Wine Type</Label>
            <Input
              id="edit-type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="e.g., Red, White, Rosé, Sparkling"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-grape">Grape Varietal</Label>
              <Input
                id="edit-grape"
                value={formData.grape}
                onChange={(e) => setFormData({ ...formData, grape: e.target.value })}
                placeholder="e.g., Cabernet Sauvignon"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-region">Region</Label>
              <Input
                id="edit-region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., Bordeaux"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-country">Country</Label>
            <Input
              id="edit-country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="e.g., France"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-vintage">Vintage</Label>
              <Input
                id="edit-vintage"
                type="number"
                value={formData.vintage}
                onChange={(e) => setFormData({ ...formData, vintage: e.target.value })}
                placeholder="e.g., 2015"
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-score">Score (out of 5)</Label>
              <Input
                id="edit-score"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.score}
                onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                placeholder="e.g., 4.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantity (bottles) *</Label>
            <Input
              id="edit-quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Tasting notes, storage location, etc."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

