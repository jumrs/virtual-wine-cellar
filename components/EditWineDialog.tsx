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
import { Loader2, Save, Trash2, X, Star, MapPin, Wine, Calendar, Grape, Globe, Package, Plus, Minus, ImageIcon } from "lucide-react";
import { GrapeSelector } from "@/components/ui/grape-selector";
import { parseGrapeString, isBlend as checkIsBlend } from "@/lib/grapeVarieties";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import type { Wine as WineType } from "./WineCard";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { EditWineImageDialog } from "@/components/EditWineImageDialog";

interface EditWineDialogProps {
  wine: WineType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onImageUpdate?: () => void;
}

// Star rating component for editing with decimal support
function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [inputValue, setInputValue] = useState(value > 0 ? value.toFixed(1) : "");
  const [isFocused, setIsFocused] = useState(false);
  
  // Update input when value prop changes, but only if not currently focused
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value > 0 ? value.toFixed(1) : "");
    }
  }, [value, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 5) {
      onChange(numValue);
    } else if (newValue === "" || newValue === ".") {
      onChange(0);
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || numValue < 0) {
      setInputValue("0.0");
      onChange(0);
    } else if (numValue > 5) {
      setInputValue("5.0");
      onChange(5);
    } else {
      setInputValue(numValue.toFixed(1));
      onChange(numValue);
    }
  };

  const handleStarClick = (starValue: number) => {
    if (value === starValue) {
      onChange(0);
    } else {
      onChange(starValue);
    }
  };

  // Calculate partial fill for display
  const fullStars = Math.floor(value);
  const partialFill = value - fullStars;
  const nextStarIndex = fullStars;

  return (
    <div className="space-y-3">
      {/* Visual Star Display */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = star <= fullStars;
          const isPartial = star === nextStarIndex + 1 && partialFill > 0;
          
          return (
            <button
              key={star}
              type="button"
              onClick={() => handleStarClick(star)}
              className="p-1 hover:scale-110 transition-transform relative"
            >
              {isFull ? (
                <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              ) : isPartial ? (
                <div className="relative w-6 h-6 flex-shrink-0">
                  {/* Empty star background */}
                  <Star className="w-6 h-6 text-gray-300 absolute inset-0" />
                  {/* Partial fill */}
                  <div 
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${partialFill * 100}%` }}
                  >
                    <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  </div>
                </div>
              ) : (
                <Star className="w-6 h-6 text-gray-300" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Decimal Input */}
      <div className="flex items-center gap-3">
        <Label htmlFor="rating-input" className="text-sm font-medium">
          Rating:
        </Label>
        <Input
          id="rating-input"
          type="number"
          step="0.1"
          min="0"
          max="5"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="0.0"
          className="w-24 h-10 elegant-input text-center"
        />
        <span className="text-sm text-muted-foreground">/ 5.0</span>
      </div>
    </div>
  );
}

export function EditWineDialog({ wine, open, onOpenChange, onSave, onImageUpdate }: EditWineDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    grape: "", // Legacy field
    grapes: [] as string[], // New array field
    is_blend: false,
    region: "",
    country: "",
    vintage: "",
    score: "",
    notes: "",
    quantity: 1,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageEditOpen, setImageEditOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (wine) {
      // Handle grapes: use grapes array if available, otherwise parse legacy grape string
      const grapes = wine.grapes && wine.grapes.length > 0 
        ? wine.grapes 
        : wine.grape 
          ? parseGrapeString(wine.grape)
          : [];
      
      setFormData({
        name: wine.name || "",
        type: wine.type || "",
        grape: wine.grape || "", // Keep for backward compat
        grapes: grapes,
        is_blend: wine.is_blend ?? checkIsBlend(grapes),
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
          grape: formData.grapes.length > 0 ? formData.grapes.join(", ") : null, // Legacy field for backward compat
          grapes: formData.grapes,
          is_blend: formData.grapes.length > 1,
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
              className="object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setImageViewerOpen(true)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur z-10"
            >
              <X className="w-4 h-4" />
            </Button>
            {/* Edit Image Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setImageEditOpen(true);
              }}
              className="absolute bottom-3 right-3 rounded-full h-9 px-3 text-xs bg-background/90 backdrop-blur hover:bg-background z-10"
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              Edit Photo
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
            {/* Add Photo Button when no image */}
            {wine && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageEditOpen(true);
                }}
                className="mt-4 rounded-full h-9 px-3 text-xs"
              >
                <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                Add Photo
              </Button>
            )}
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

          {/* Grapes Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Grape className="w-4 h-4 text-muted-foreground" />
              Grapes
            </Label>
            <GrapeSelector
              value={formData.grapes}
              onChange={(grapes) => setFormData({ 
                ...formData, 
                grapes, 
                is_blend: grapes.length > 1,
                grape: grapes.join(", ") // Update legacy field
              })}
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

          {/* Quantity Section - Mobile Friendly */}
          <div className="space-y-2">
            <Label htmlFor="edit-quantity" className="text-sm font-medium flex items-center gap-1">
              <Package className="w-3 h-3 text-muted-foreground" />
              Bottles
            </Label>
            <div className="quantity-controls">
              {/* Decrease Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ ...formData, quantity: Math.max(0, formData.quantity - 1) })}
                className="quantity-control-btn"
                disabled={formData.quantity <= 0}
              >
                <Minus className="h-5 w-5" />
              </Button>
              
              {/* Quantity Input */}
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                onBlur={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setFormData({ ...formData, quantity: Math.max(0, value) });
                }}
                required
                className="elegant-input h-12 text-center text-lg font-semibold flex-1 touch-manipulation"
                inputMode="numeric"
              />
              
              {/* Increase Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ ...formData, quantity: formData.quantity + 1 })}
                className="quantity-control-btn"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Tap buttons to adjust or type directly
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-notes" className="text-sm font-medium">Notes</Label>
            <textarea
              id="edit-notes"
              className="elegant-input w-full min-h-[80px] rounded-xl resize-none"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Your notes..."
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

      {/* Edit Wine Image Dialog */}
      {wine && (
        <EditWineImageDialog
          wine={wine}
          open={imageEditOpen}
          onOpenChange={setImageEditOpen}
          onImageUpdated={() => {
            onImageUpdate?.();
            onSave(); // Refresh the wine data
          }}
        />
      )}

      {/* Full Size Image Viewer */}
      {wine?.label_image_url && (
        <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0 bg-black/90 border-0 shadow-none">
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <div className="relative w-full h-full max-w-full max-h-full">
                <Image
                  src={wine.label_image_url}
                  alt={wine.name}
                  fill
                  className="object-contain"
                  sizes="95vw"
                  priority
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setImageViewerOpen(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/90 backdrop-blur hover:bg-background/80 z-10 text-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
