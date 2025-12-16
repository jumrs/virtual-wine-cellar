"use client";

import { useState, useCallback, memo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Wine, Package, Star, Plus, Minus, Sparkles } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { getCountryCode, getWineTypeBadgeClass, isPremiumWine } from "@/lib/wineUtils";
import type { Wine as WineType } from "@/types";

// Re-export Wine type for backward compatibility
export type { Wine } from "@/types";

// Lazy load the notes dialog to reduce initial bundle
const NotesDialog = lazy(() => import("./WineNotesDialog").then(m => ({ default: m.WineNotesDialog })));

interface WineCardProps {
  wine: WineType;
  onDelete: (id: string) => void;
  onEdit: (wine: WineType) => void;
  onImageUpdate?: () => void;
  onQuantityUpdate?: () => void;
  isRanOut?: boolean;
}

/** Country flag component using CDN flags */
const CountryFlag = memo(function CountryFlag({ countryCode }: { countryCode: string }) {
  if (!countryCode) return null;

  return (
    <span
      className="inline-block w-7 h-5 rounded-sm overflow-hidden border border-border/30 shadow-sm"
      style={{
        backgroundImage: `url(https://flagcdn.com/w40/${countryCode.toLowerCase()}.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      title={countryCode}
    />
  );
});

/** Star rating display with partial star support */
const StarRating = memo(function StarRating({ score }: { score: number }) {
  const fullStars = Math.floor(score);
  const partialFill = score - fullStars;
  const emptyStars = 5 - fullStars - (partialFill > 0 ? 1 : 0);

  return (
    <div className="star-rating">
      {/* Full stars */}
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className="w-3.5 h-3.5 star-filled" />
      ))}

      {/* Partial star */}
      {partialFill > 0 && (
        <div className="relative w-3.5 h-3.5 flex-shrink-0">
          <Star className="w-3.5 h-3.5 star-empty absolute inset-0" />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${partialFill * 100}%` }}
          >
            <Star className="w-3.5 h-3.5 star-filled" />
          </div>
        </div>
      )}

      {/* Empty stars */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className="w-3.5 h-3.5 star-empty" />
      ))}
    </div>
  );
});

/** Wine card component - memoized for performance */
export const WineCard = memo(function WineCard({
  wine,
  onDelete,
  onEdit,
  onImageUpdate,
  onQuantityUpdate,
  isRanOut = false,
}: WineCardProps) {
  const [updatingQuantity, setUpdatingQuantity] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const { toast } = useToast();

  // Memoized computed values
  const isPremium = isPremiumWine(wine);
  const hasNotes = wine.notes && wine.notes.trim().length > 0;
  const countryCode = getCountryCode(wine.country);
  const typeBadgeClass = getWineTypeBadgeClass(wine.type);

  const handleQuantityChange = useCallback(
    async (e: React.MouseEvent, delta: number) => {
      e.stopPropagation();
      if (updatingQuantity) return;

      const newQuantity = Math.max(0, (wine.quantity || 0) + delta);

      setUpdatingQuantity(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
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
          description: error.message || "Failed to update quantity.",
          variant: "destructive",
        });
      } finally {
        setUpdatingQuantity(false);
      }
    },
    [wine.id, wine.quantity, updatingQuantity, onQuantityUpdate, toast]
  );

  const handleCardClick = useCallback(() => {
    onEdit(wine);
  }, [onEdit, wine]);

  const handleNotesClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesOpen(true);
  }, []);

  return (
    <>
      <div
        className={cn(
          "wine-card cursor-pointer group",
          isRanOut && "opacity-50 grayscale",
          isPremium && "wine-card-premium"
        )}
        onClick={handleCardClick}
      >
        {/* Image Container */}
        <div className="wine-image-container aspect-[3/4] relative">
          {wine.label_image_url ? (
            <Image
              src={wine.label_image_url}
              alt={wine.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-muted to-muted/50">
              <Wine className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}

          {/* Wine Type Badge */}
          {wine.type && (
            <div className={cn("wine-badge absolute top-2 left-2", typeBadgeClass)}>
              {wine.type}
            </div>
          )}

          {/* Country Flag */}
          {countryCode && (
            <div className="absolute top-2 right-2">
              <CountryFlag countryCode={countryCode} />
            </div>
          )}

          {/* Notes Button */}
          {hasNotes && (
            <button
              onClick={handleNotesClick}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 active:scale-95 transition-all duration-200 touch-manipulation z-10"
              aria-label="View AI notes"
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </button>
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

          {/* Grape Tags */}
          {wine.grapes && wine.grapes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {wine.grapes.slice(0, 3).map((grape) => (
                <span
                  key={grape}
                  className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full whitespace-nowrap"
                  title={grape}
                >
                  {grape}
                </span>
              ))}
              {wine.grapes.length > 3 && (
                <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded-full">
                  +{wine.grapes.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Rating & Quantity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {wine.score !== null && wine.score !== undefined ? (
                <>
                  <StarRating score={wine.score} />
                  <span className="text-xs font-medium ml-1">
                    {wine.score.toFixed(1)}
                  </span>
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

      {/* Notes Dialog - Lazy loaded */}
      {hasNotes && notesOpen && (
        <Suspense fallback={null}>
          <NotesDialog
            wine={wine}
            open={notesOpen}
            onOpenChange={setNotesOpen}
          />
        </Suspense>
      )}
    </>
  );
});
