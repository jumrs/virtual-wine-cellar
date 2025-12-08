"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

interface ExtractedWineData {
  name: string;
  grape?: string;
  region?: string;
  vintage?: number;
  notes?: string;
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedWineData | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setExtractedData(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to analyze image: ${response.statusText}`);
      }

      const data = await response.json();
      setExtractedData(data);
      toast({
        title: "Success",
        description: "Wine details extracted successfully!",
      });
    } catch (error: any) {
      console.error("Analyze error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze wine label. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData || !file) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      // Upload image to Supabase storage first
      const formData = new FormData();
      formData.append("image", file);
      formData.append("wineData", JSON.stringify(extractedData));

      const response = await fetch("/api/wines", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Failed to save wine: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error("API Error Response:", errorData);
        } catch (e) {
          const text = await response.text();
          console.error("API Error Text:", text);
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: "Wine added to your cellar!",
      });

      // Reset form
      setFile(null);
      setPreview(null);
      setExtractedData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Redirect to home page after a short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save wine. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Wine Label</CardTitle>
          <CardDescription>
            Upload a photo of your wine label to automatically extract details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wine-image">Wine Label Image</Label>
            <Input
              id="wine-image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
          </div>

          {preview && (
            <div className="relative w-full h-64 rounded-lg overflow-hidden border">
              <Image
                src={preview}
                alt="Wine label preview"
                fill
                className="object-contain"
              />
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Analyze Label
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Wine Details</CardTitle>
            <CardDescription>Review and save the extracted information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={extractedData.name} readOnly />
            </div>
            {extractedData.grape && (
              <div className="space-y-2">
                <Label>Grape Varietal</Label>
                <Input value={extractedData.grape} readOnly />
              </div>
            )}
            {extractedData.region && (
              <div className="space-y-2">
                <Label>Region</Label>
                <Input value={extractedData.region} readOnly />
              </div>
            )}
            {extractedData.vintage && (
              <div className="space-y-2">
                <Label>Vintage</Label>
                <Input value={extractedData.vintage} readOnly />
              </div>
            )}
            {extractedData.notes && (
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Input value={extractedData.notes} readOnly />
              </div>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save to Cellar"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

