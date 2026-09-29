"use client";

import { useState, useRef, useCallback } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";

interface ImageCropDialogProps {
    imageUrl: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCropComplete: (croppedBlob: Blob) => void;
    saving?: boolean;
}

/**
 * Creates a cropped image blob from the original image and crop area
 */
async function getCroppedImg(
    image: HTMLImageElement,
    crop: PixelCrop
): Promise<Blob> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("No 2d context");
    }

    // Calculate the scale between the displayed image and the natural image
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas size to the cropped area (at natural resolution)
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    // Draw the cropped image at natural resolution
    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Convert to blob
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to create blob"));
                }
            },
            "image/jpeg",
            0.9
        );
    });
}

export function ImageCropDialog({
    imageUrl,
    open,
    onOpenChange,
    onCropComplete,
    saving = false,
}: ImageCropDialogProps) {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    const handleSave = useCallback(async () => {
        if (!completedCrop || !imgRef.current) return;

        try {
            const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
            onCropComplete(croppedBlob);
        } catch (error) {
            console.error("Error cropping image:", error);
        }
    }, [completedCrop, onCropComplete]);

    const handleCancel = useCallback(() => {
        setCrop(undefined);
        setCompletedCrop(undefined);
        onOpenChange(false);
    }, [onOpenChange]);

    const onImageLoad = useCallback(() => {
        // Set initial crop to full image
        if (imgRef.current) {
            const { width, height } = imgRef.current;
            const initialCrop: Crop = {
                unit: "px",
                x: 0,
                y: 0,
                width: width,
                height: height,
            };
            setCrop(initialCrop);
            setCompletedCrop(initialCrop as PixelCrop);
        }
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0 gap-0 rounded-3xl overflow-hidden">
                <DialogHeader className="p-4 pb-2">
                    <DialogTitle className="text-xl">Crop Photo</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Drag the corners or edges to adjust the crop area
                    </p>
                </DialogHeader>

                {/* Cropper Area */}
                <div className="px-4 pb-2 flex justify-center items-center bg-muted/30">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        minWidth={50}
                        minHeight={50}
                    >
                        <img
                            ref={imgRef}
                            src={imageUrl}
                            alt="Crop preview"
                            onLoad={onImageLoad}
                            crossOrigin="anonymous"
                            style={{ maxHeight: "400px", maxWidth: "100%" }}
                        />
                    </ReactCrop>
                </div>

                {/* Action Buttons */}
                <div className="p-4 pt-2">
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={saving}
                            className="flex-1 h-12 rounded-xl"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                        </Button>

                        <Button
                            onClick={handleSave}
                            disabled={saving || !completedCrop}
                            className="flex-1 h-12 rounded-xl btn-wine"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Save
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
