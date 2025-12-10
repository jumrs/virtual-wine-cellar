"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wine, Package, Star, ImageIcon, Plus, Minus } from "lucide-react";
import Image from "next/image";
import { EditWineImageDialog } from "@/components/EditWineImageDialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

export interface Wine {
  id: string;
  name: string;
  type?: string;
  region?: string;
  country?: string;
  grape?: string;
  vintage?: number;
  score?: number | null;
  label_image_url?: string;
  notes?: string;
  date_added?: string;
  quantity?: number;
}

interface WineCardProps {
  wine: Wine;
  onDelete: (id: string) => void;
  onEdit: (wine: Wine) => void;
  onImageUpdate?: () => void;
  onQuantityUpdate?: () => void;
  isRanOut?: boolean;
}

// Helper to get wine type badge color
function getWineTypeBadgeClass(type?: string): string {
  if (!type) return "bg-muted text-muted-foreground";
  const lowerType = type.toLowerCase();
  if (lowerType.includes("red")) return "wine-badge-red";
  if (lowerType.includes("white")) return "wine-badge-white";
  if (lowerType.includes("rosé") || lowerType.includes("rose")) return "wine-badge-rose";
  if (lowerType.includes("sparkling") || lowerType.includes("champagne")) return "wine-badge-sparkling";
  return "bg-muted text-muted-foreground";
}

// Star rating component
function StarRating({ score }: { score: number }) {
  const fullStars = Math.floor(score);
  const hasHalfStar = score - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="star-rating">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className="w-3.5 h-3.5 star-filled" />
      ))}
      {hasHalfStar && (
        <Star className="w-3.5 h-3.5 text-yellow-400" style={{ clipPath: "inset(0 50% 0 0)" }} />
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className="w-3.5 h-3.5 star-empty" />
      ))}
    </div>
  );
}

export function WineCard({ wine, onDelete, onEdit, onImageUpdate, onQuantityUpdate, isRanOut = false }: WineCardProps) {
  const [imageEditOpen, setImageEditOpen] = useState(false);
  const [updatingQuantity, setUpdatingQuantity] = useState(false);
  const { toast } = useToast();

  const handleQuantityChange = async (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    if (updatingQuantity) return;
    
    const newQuantity = Math.max(0, (wine.quantity || 0) + delta);
    
    setUpdatingQuantity(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/wines/quantity", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wineId: wine.id,
          quantity: newQuantity,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update quantity");
      }

      onQuantityUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update quantity. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingQuantity(false);
    }
  };

  return (
    <>
      <div 
        className={cn(
          "wine-card cursor-pointer group",
          isRanOut && "opacity-50 grayscale"
        )}
        onClick={() => onEdit(wine)}
      >
        {/* Image Container */}
        <div className="wine-image-container aspect-[3/4] relative">
          {wine.label_image_url ? (
            <Image
              src={wine.label_image_url}
              alt={wine.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-muted to-muted/50">
              <Wine className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Image Edit Button - appears on hover */}
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-8 px-3 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setImageEditOpen(true);
            }}
          >
            <ImageIcon className="h-3 w-3 mr-1" />
            Edit
          </Button>

          {/* Wine Type Badge */}
          {wine.type && (
            <div className={cn("wine-badge absolute top-2 left-2", getWineTypeBadgeClass(wine.type))}>
              {wine.type}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Name & Vintage */}
          <div>
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight">
              {wine.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {wine.vintage && <span>{wine.vintage}</span>}
              {wine.vintage && wine.region && <span> • </span>}
              {wine.region && <span>{wine.region}</span>}
            </p>
          </div>

          {/* Rating & Quantity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {wine.score !== null && wine.score !== undefined ? (
                <>
                  <StarRating score={wine.score} />
                  <span className="text-xs font-medium ml-1">{wine.score.toFixed(1)}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No rating</span>
              )}
            </div>
            
            {/* Quantity Badge */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package className="w-3 h-3" />
              <span>{wine.quantity || 0}</span>
            </div>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/50">
            <button
              className="quantity-btn"
              onClick={(e) => handleQuantityChange(e, -1)}
              disabled={updatingQuantity || (wine.quantity || 0) === 0}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium w-8 text-center">
              {wine.quantity || 0}
            </span>
            <button
              className="quantity-btn"
              onClick={(e) => handleQuantityChange(e, 1)}
              disabled={updatingQuantity}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <EditWineImageDialog
        wine={wine}
        open={imageEditOpen}
        onOpenChange={setImageEditOpen}
        onImageUpdated={onImageUpdate}
      />
    </>
  );
}
