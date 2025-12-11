"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wine, Package, Star } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface DuplicateWine {
  id: string;
  name: string;
  type?: string;
  vintage?: number;
  region?: string;
  country?: string;
  quantity: number;
  score?: number | null;
  label_image_url?: string;
}

interface DuplicateWineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateWines: DuplicateWine[];
  newWineName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DuplicateWineDialog({
  open,
  onOpenChange,
  duplicateWines,
  newWineName,
  onConfirm,
  onCancel,
}: DuplicateWineDialogProps) {
  if (duplicateWines.length === 0) return null;

  const duplicate = duplicateWines[0]; // Show the first duplicate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="font-serif text-xl">Possible Duplicate</DialogTitle>
              <DialogDescription className="text-sm">
                This wine might already be in your cellar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* New Wine Info */}
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">You're adding:</p>
            <p className="font-semibold">{newWineName}</p>
          </div>

          {/* Existing Wine Info */}
          <div className="wine-card p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Already in your cellar:</p>
            <div className="flex gap-4">
              {duplicate.label_image_url ? (
                <div className="w-20 h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <Image
                    src={duplicate.label_image_url}
                    alt={duplicate.name}
                    width={80}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-28 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Wine className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{duplicate.name}</h3>
                <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                  {duplicate.type && <p>{duplicate.type}</p>}
                  {duplicate.vintage && <p>{duplicate.vintage}</p>}
                  {(duplicate.region || duplicate.country) && (
                    <p>{[duplicate.region, duplicate.country].filter(Boolean).join(", ")}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    {duplicate.score !== null && duplicate.score !== undefined && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-medium">{duplicate.score.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      <span className="text-xs">{duplicate.quantity} {duplicate.quantity === 1 ? "bottle" : "bottles"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {duplicateWines.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              + {duplicateWines.length - 1} other similar {duplicateWines.length - 1 === 1 ? "wine" : "wines"}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="w-full sm:w-auto rounded-xl btn-wine"
          >
            Add Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


