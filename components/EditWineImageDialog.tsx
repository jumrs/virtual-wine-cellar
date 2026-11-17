"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, Loader2, Camera, X, Crop, ClipboardPaste, Check } from "lucide-react";
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

/** Image types the upload API accepts (see validateImageFile in lib/security.ts) */
const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Re-encode an image blob through a canvas (to change its format or shrink it) */
async function reencodeImage(blob: Blob, type: string, quality?: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image");
  if (type === "image/jpeg") {
    // JPEG has no transparency; paint it on white like the bottle backgrounds
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image"))), type, quality)
  );
}

/**
 * Turn a pasted image into a File the upload API accepts: a supported type,
 * a filename whose extension matches it, and under the size limit.
 */
async function preparePastedImage(blob: Blob): Promise<File> {
  let image = blob;
  if (!ACCEPTED_TYPES[image.type]) {
    image = await reencodeImage(image, "image/png"); // e.g. BMP or TIFF from some apps
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    image = await reencodeImage(image, "image/jpeg", 0.9); // large screenshots
    if (image.size > MAX_UPLOAD_BYTES) image = await reencodeImage(image, "image/jpeg", 0.75);
    if (image.size > MAX_UPLOAD_BYTES) throw new Error("The pasted image is too large (max 10 MB).");
  }
  return new File([image], `pasted-image-${Date.now()}.${ACCEPTED_TYPES[image.type]}`, {
    type: image.type,
  });
}

/** "⌘V" on Apple devices, "Ctrl+V" elsewhere */
function pasteShortcut(): string {
  if (typeof navigator === "undefined") return "Ctrl+V";
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "⌘V" : "Ctrl+V";
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
  // A pasted image waiting for the user to save (or crop) it
  const [pastedFile, setPastedFile] = useState<File | null>(null);
  const [pastedPreview, setPastedPreview] = useState<string | null>(null);
  const [preparingPaste, setPreparingPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const shortcut = pasteShortcut();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Object URL of the pasted preview, kept in a ref so it can be released on unmount
  const previewUrlRef = useRef<string | null>(null);
  const setPreviewUrl = useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPastedPreview(url);
  }, []);

  const clearPasted = useCallback(() => {
    setPastedFile(null);
    setPreviewUrl(null);
  }, [setPreviewUrl]);

  // Drop any pending pasted image when the dialog closes or unmounts
  useEffect(() => {
    if (!open) clearPasted();
  }, [open, clearPasted]);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

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

  /** Show a pasted image as a preview so the user can save or crop it */
  const acceptPastedImage = useCallback(async (blob: Blob) => {
    setPreparingPaste(true);
    try {
      const file = await preparePastedImage(blob);
      setPastedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error: unknown) {
      toast({
        title: "Couldn't use the pasted image",
        description: error instanceof Error ? error.message : "Please try another image.",
        variant: "destructive",
      });
    } finally {
      setPreparingPaste(false);
    }
  }, [toast, setPreviewUrl]);

  // Paste with the keyboard (Ctrl+V / ⌘V) anywhere while the dialog is open
  useEffect(() => {
    if (!open || cropDialogOpen) return;

    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input:not([type=file]), textarea, [contenteditable='true']")) return;

      const item = Array.from(e.clipboardData?.items ?? []).find(
        (i) => i.kind === "file" && i.type.startsWith("image/")
      );
      const blob = item?.getAsFile();
      if (!blob) {
        toast({
          title: "No image to paste",
          description: "Copy an image first, then paste it here.",
        });
        return;
      }
      e.preventDefault();
      void acceptPastedImage(blob);
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, cropDialogOpen, acceptPastedImage, toast]);

  // "Paste Image" button: read the clipboard directly where the browser allows it
  const handlePasteButton = useCallback(async () => {
    if (!navigator.clipboard?.read) {
      toast({
        title: `Press ${shortcut} to paste`,
        description: "Your browser doesn't allow reading images from the clipboard with a button.",
      });
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          await acceptPastedImage(await item.getType(type));
          return;
        }
      }
      toast({
        title: "No image on the clipboard",
        description: "Copy an image first, then tap Paste Image.",
      });
    } catch {
      toast({
        title: "Couldn't read the clipboard",
        description: `Allow clipboard access when asked, or press ${shortcut} instead.`,
      });
    }
  }, [acceptPastedImage, shortcut, toast]);

  const handleSavePasted = async () => {
    if (!pastedFile) return;
    setUploading(true);
    try {
      await uploadImage(pastedFile);
      toast({
        title: "Image updated",
        description: "Your pasted photo has been saved.",
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
    }
  };

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

  const busy = uploading || removing || preparingPaste;
  const previewUrl = pastedPreview ?? wine.label_image_url;
  // Crop the pasted image if there is one, otherwise the current photo
  const cropSource = pastedPreview ?? wine.label_image_url;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0 gap-0 rounded-3xl overflow-hidden">
          {/* Image preview: the pasted image (pending save) or the current photo */}
          <div className="relative h-48 bg-gradient-to-b from-muted to-muted/50">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={pastedPreview ? "Pasted image preview" : wine.name}
                fill
                unoptimized={!!pastedPreview}
                className="object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-12 h-12 text-muted-foreground/40" />
              </div>
            )}
            {pastedPreview && (
              <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                Pasted image
              </span>
            )}
            {preparingPaste && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl">Edit Photo</DialogTitle>
              <p className="text-sm text-muted-foreground">{wine.name}</p>
            </DialogHeader>

            {pastedPreview ? (
              <>
                {/* Pasted image: save as-is, crop first, or discard */}
                <Button
                  onClick={handleSavePasted}
                  disabled={busy}
                  className="w-full h-12 rounded-xl btn-wine"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Pasted Photo
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleEditPhoto}
                  disabled={busy}
                  variant="outline"
                  className="w-full h-12 rounded-xl border-primary text-primary hover:bg-primary/10"
                >
                  <Crop className="h-4 w-4 mr-2" />
                  Crop Before Saving
                </Button>
                <Button
                  onClick={clearPasted}
                  disabled={busy}
                  variant="ghost"
                  className="w-full h-11 rounded-xl text-muted-foreground"
                >
                  Discard
                </Button>
              </>
            ) : (
              <>
                {/* Edit Photo Button - Only show when image exists */}
                {wine.label_image_url && (
                  <Button
                    onClick={handleEditPhoto}
                    disabled={busy}
                    variant="outline"
                    className="w-full h-12 rounded-xl border-primary text-primary hover:bg-primary/10"
                  >
                    <Crop className="h-4 w-4 mr-2" />
                    Crop Photo
                  </Button>
                )}

                {/* Upload / paste */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleFileSelect}
                    disabled={busy}
                    className="h-12 rounded-xl btn-wine px-3"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handlePasteButton}
                    disabled={busy}
                    variant="outline"
                    className="h-12 rounded-xl px-3"
                  >
                    <ClipboardPaste className="h-4 w-4 mr-2" />
                    Paste Image
                  </Button>
                </div>
                <p className="-mt-1 text-center text-xs text-muted-foreground">
                  Tip: press{" "}
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[11px]">
                    {shortcut}
                  </kbd>{" "}
                  to paste a copied image
                </p>
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
                    disabled={busy}
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Crop Dialog: the pasted image if pending, otherwise the current photo */}
      {cropSource && (
        <ImageCropDialog
          imageUrl={cropSource}
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          onCropComplete={handleCropComplete}
          saving={savingCrop}
        />
      )}
    </>
  );
}
