"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Wine, Package, Edit, Star, ImageIcon, Plus, Minus } from "lucide-react";
import Image from "next/image";
import { EditWineImageDialog } from "@/components/EditWineImageDialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

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

export function WineCard({ wine, onDelete, onEdit, onImageUpdate, onQuantityUpdate, isRanOut = false }: WineCardProps) {
  const [imageEditOpen, setImageEditOpen] = useState(false);
  const [updatingQuantity, setUpdatingQuantity] = useState(false);
  const { toast } = useToast();

  const handleQuantityChange = async (delta: number) => {
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
      <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${isRanOut ? 'opacity-60 grayscale' : ''}`} onClick={() => onEdit(wine)}>
        {wine.label_image_url && (
          <div className="w-full h-64 relative rounded-t-lg overflow-hidden border-b group">
            <Image
              src={wine.label_image_url}
              alt={wine.name}
              fill
              className="object-contain bg-background"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setImageEditOpen(true);
              }}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Edit Image
            </Button>
          </div>
        )}
        {!wine.label_image_url && (
          <div className="w-full h-64 relative rounded-t-lg overflow-hidden border-b bg-muted flex items-center justify-center group">
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No image</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setImageEditOpen(true);
              }}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Add Image
            </Button>
          </div>
        )}
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{wine.name}</CardTitle>
            <CardDescription>
              {wine.type && (
                <span className="block font-medium text-foreground">{wine.type}</span>
              )}
              {wine.grape && <span className="block">{wine.grape}</span>}
              {wine.country && <span className="block">{wine.country}</span>}
              {wine.region && <span className="block">{wine.region}</span>}
              {wine.vintage && <span className="block">Vintage: {wine.vintage}</span>}
              {wine.quantity !== undefined && (
                <span className="block flex items-center gap-1 mt-2 font-medium text-foreground">
                  <Package className="h-3 w-3" />
                  {wine.quantity} {wine.quantity === 1 ? "bottle" : "bottles"}
                </span>
              )}
              {wine.quantity === 0 && (
                <span className="block text-sm text-muted-foreground mt-1 italic">
                  Out of stock
                </span>
              )}
            </CardDescription>
          </div>
          {wine.score !== null && wine.score !== undefined && (
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{wine.score.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">/5</div>
                </div>
              </div>
              {/* Quantity Controls */}
              <div className="flex gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-10 w-10 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuantityChange(-1);
                  }}
                  disabled={updatingQuantity || (wine.quantity || 0) === 0}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-10 w-10 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuantityChange(1);
                  }}
                  disabled={updatingQuantity}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
          {(!wine.score || wine.score === null || wine.score === undefined) && (
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {/* Quantity Controls when no score */}
              <div className="flex gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-10 w-10 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuantityChange(-1);
                  }}
                  disabled={updatingQuantity || (wine.quantity || 0) === 0}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-10 w-10 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuantityChange(1);
                  }}
                  disabled={updatingQuantity}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      {wine.notes && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{wine.notes}</p>
        </CardContent>
      )}
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(wine);
            }}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(wine.id);
            }}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
      </CardContent>
      </Card>
      <EditWineImageDialog
        wine={wine}
        open={imageEditOpen}
        onOpenChange={setImageEditOpen}
        onImageUpdated={onImageUpdate}
      />
    </>
  );
}

