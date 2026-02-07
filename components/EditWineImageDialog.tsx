"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, Loader2, Camera, X, Crop } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { type Wine } from "@/components/WineCard";
import Image from "next/image";
import { ImageCropDialog } from "./ImageCropDialog";

interface EditWineImageDialogProps {
  wine: Wine;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageUpdated?: () => void;
}

export function EditWineImageDialog({
  wine,
  open,
  onOpenChange,
  onImageUpdated,
}: EditWineImageDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [savingCrop, setSavingCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const uploadImage = useCallback(async (file: File | Blob) => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    // Convert Blob to File with proper extension if needed
    let uploadFile: File;
    if (file instanceof File) {
      uploadFile = file;
    } else {
      // Create a File from the Blob with a proper filename
      uploadFile = new File([file], `cropped-image-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
    }

    const formData = new FormData();
    formData.append("image", uploadFile);
    formData.append("wineId", wine.id);

    const response = await fetch("/api/wines/image", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to upload image");
    }

    return response;
  }, [wine.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadImage(file);

      toast({
        title: "Image updated",
        description: "Your wine photo has been updated.",
      });

      onImageUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCropComplete = useCallback(async (croppedBlob: Blob) => {
    setSavingCrop(true);
    try {
      await uploadImage(croppedBlob);

      toast({
        title: "Image updated",
        description: "Your cropped photo has been saved.",
      });

      setCropDialogOpen(false);
      onImageUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save cropped image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingCrop(false);
    }
  }, [uploadImage, toast, onImageUpdated, onOpenChange]);

  const handleRemove = async () => {
    if (!confirm("Are you sure you want to remove this image?")) {
      return;
    }

    setRemoving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/wines/image", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wineId: wine.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to remove image");
      }

      toast({
        title: "Image removed",
        description: "The wine photo has been removed.",
      });

      onImageUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  const handleEditPhoto = useCallback(() => {
    setCropDialogOpen(true);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0 gap-0 rounded-3xl overflow-hidden">
          {/* Current Image Preview */}
          <div className="relative h-48 bg-gradient-to-b from-muted to-muted/50">
            {wine.label_image_url ? (
              <Image
                src={wine.label_image_url}
                alt={wine.name}
                fill
                className="object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-12 h-12 text-muted-foreground/40" />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Edit Photo</DialogTitle>
              <p className="text-sm text-muted-foreground">{wine.name}</p>
            </DialogHeader>

            {/* Edit Photo Button - Only show when image exists */}
            {wine.label_image_url && (
              <Button
                onClick={handleEditPhoto}
                disabled={uploading || removing}
                variant="outline"
                className="w-full h-12 rounded-xl border-primary text-primary hover:bg-primary/10"
              >
                <Crop className="h-4 w-4 mr-2" />
                Crop Photo
              </Button>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleFileSelect}
              disabled={uploading || removing}
              className="w-full h-12 rounded-xl btn-wine"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Photo
                </>
              )}
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Remove Button */}
            {wine.label_image_url && (
              <Button
                onClick={handleRemove}
                disabled={removing || uploading}
                variant="outline"
                className="w-full h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {removing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Photo
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Crop Dialog */}
      {wine.label_image_url && (
        <ImageCropDialog
          imageUrl={wine.label_image_url}
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          onCropComplete={handleCropComplete}
          saving={savingCrop}
        />
      )}
    </>
  );
}

