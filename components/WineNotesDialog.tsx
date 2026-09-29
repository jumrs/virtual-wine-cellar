"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Wine } from "@/types";

interface WineNotesDialogProps {
  wine: Wine;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component for displaying wine tasting notes
 * Separated for lazy loading - only loaded when user clicks notes button
 */
export const WineNotesDialog = memo(function WineNotesDialog({
  wine,
  open,
  onOpenChange,
}: WineNotesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] p-0 gap-0 rounded-3xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Notes
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            {wine.name}
            {wine.vintage && ` • ${wine.vintage}`}
          </p>
        </DialogHeader>
        <div className="p-6 overflow-y-auto">
          <div className="prose prose-sm max-w-none">
            <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
              {wine.notes}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

