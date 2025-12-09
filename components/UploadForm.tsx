"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, X, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

interface ExtractedWineData {
  name: string;
  type?: string;
  grape?: string;
  region?: string;
  country?: string;
  vintage?: number;
  notes?: string;
}

interface WineWithFile {
  file: File;
  preview: string;
  extractedData: ExtractedWineData | null;
  quantity: number;
  analyzing: boolean;
  saving: boolean;
  saved: boolean;
  error?: string;
}

const MAX_FILES = 5;

export function UploadForm() {
  const [wines, setWines] = useState<WineWithFile[]>([]);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const winesRef = useRef<WineWithFile[]>([]);
  const { toast } = useToast();
  

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;

    // Limit to MAX_FILES
    const filesToAdd = selectedFiles.slice(0, MAX_FILES - wines.length);
    
    if (selectedFiles.length > MAX_FILES - wines.length) {
      toast({
        title: "Too many files",
        description: `You can upload a maximum of ${MAX_FILES} images at once. Only the first ${MAX_FILES - wines.length} will be added.`,
        variant: "destructive",
      });
    }

    const newWines: WineWithFile[] = filesToAdd.map((file) => {
      const preview = URL.createObjectURL(file);
      return {
        file,
        preview,
        extractedData: null,
        quantity: 1,
        analyzing: false,
        saving: false,
        saved: false,
      };
    });

    setWines((prevWines) => {
      const updated = [...prevWines, ...newWines];
      winesRef.current = updated;
      return updated;
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeWine = (index: number) => {
    setWines((prevWines) => {
      const wine = prevWines[index];
      if (wine) {
        URL.revokeObjectURL(wine.preview);
      }
      const updated = prevWines.filter((_, i) => i !== index);
      winesRef.current = updated;
      return updated;
    });
  };

  const analyzeWine = async (index: number) => {
    const wine = wines[index];
    if (!wine || wine.analyzing) return;

    // Use functional update to ensure we have the latest state
    setWines((prevWines) => {
      const updated = prevWines.map((w, i) => 
        i === index ? { ...w, analyzing: true, error: undefined } : w
      );
      winesRef.current = updated;
      return updated;
    });

    try {
      const formData = new FormData();
      formData.append("image", wine.file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to analyze image: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Use functional update to ensure we have the latest state
      setWines((prevWines) => {
        const updated = prevWines.map((w, i) => 
          i === index ? { ...w, extractedData: data, analyzing: false } : w
        );
        winesRef.current = updated;
        return updated;
      });
      
      toast({
        title: "Success",
        description: `Wine "${data.name}" analyzed successfully!`,
      });
    } catch (error: any) {
      console.error("Analyze error:", error);
      // Use functional update to ensure we have the latest state
      setWines((prevWines) => {
        const updated = prevWines.map((w, i) => 
          i === index ? { ...w, analyzing: false, error: error.message } : w
        );
        winesRef.current = updated;
        return updated;
      });
      toast({
        title: "Error",
        description: error.message || "Failed to analyze wine label. Please try again.",
        variant: "destructive",
      });
    }
  };

  const analyzeAll = async () => {
    if (analyzingAll) return;
    setAnalyzingAll(true);
    
    try {
      // Get initial list of indices that need analysis
      const indicesToAnalyze = winesRef.current
        .map((w, idx) => ({ wine: w, index: idx }))
        .filter(({ wine }) => !wine.extractedData && !wine.analyzing)
        .map(({ index }) => index);
      
      // Analyze each wine sequentially
      for (let i = 0; i < indicesToAnalyze.length; i++) {
        const index = indicesToAnalyze[i];
        
        // Double-check this wine still needs analysis (in case state changed)
        if (winesRef.current[index] && !winesRef.current[index].extractedData && !winesRef.current[index].analyzing) {
          await analyzeWine(index);
          
          // Small delay between requests to avoid rate limiting
          if (i < indicesToAnalyze.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } finally {
      setAnalyzingAll(false);
    }
  };

  const saveWine = async (index: number) => {
    const wine = wines[index];
    if (!wine.extractedData || wine.saving || wine.saved) return;

    setWines((prevWines) => {
      const updated = prevWines.map((w, i) => 
        i === index ? { ...w, saving: true, error: undefined } : w
      );
      winesRef.current = updated;
      return updated;
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const formData = new FormData();
      formData.append("image", wine.file);
      formData.append("wineData", JSON.stringify({ ...wine.extractedData, quantity: wine.quantity }));

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
        } catch (e) {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setWines((prevWines) => {
        const updated = prevWines.map((w, i) => 
          i === index ? { ...w, saving: false, saved: true } : w
        );
        winesRef.current = updated;
        return updated;
      });

      toast({
        title: "Success",
        description: `"${wine.extractedData.name}" added to your cellar!`,
      });
    } catch (error: any) {
      console.error("Save error:", error);
      setWines((prevWines) => {
        const updated = prevWines.map((w, i) => 
          i === index ? { ...w, saving: false, error: error.message } : w
        );
        winesRef.current = updated;
        return updated;
      });
      toast({
        title: "Error",
        description: error.message || "Failed to save wine. Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveAll = async () => {
    const winesToSave = winesRef.current.filter((w) => w.extractedData && !w.saved && !w.saving);
    
    if (winesToSave.length === 0) {
      toast({
        title: "No wines to save",
        description: "All wines have been saved or need to be analyzed first.",
      });
      return;
    }

    setSavingAll(true);
    
    for (let i = 0; i < winesToSave.length; i++) {
      const wineIndex = winesRef.current.findIndex((w) => w === winesToSave[i]);
      if (wineIndex !== -1) {
        await saveWine(wineIndex);
        // Small delay between requests
        if (i < winesToSave.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    setSavingAll(false);
    
    // Redirect to home page after a short delay if all saved
    const allSaved = winesRef.current.every((w) => w.saved || !w.extractedData);
    if (allSaved) {
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    }
  };

  const updateQuantity = (index: number, quantity: number) => {
    setWines((prevWines) => {
      const updated = prevWines.map((w, i) => 
        i === index ? { ...w, quantity: Math.max(1, quantity) } : w
      );
      winesRef.current = updated;
      return updated;
    });
  };

  const allAnalyzed = wines.length > 0 && wines.every((w) => w.extractedData || w.analyzing);
  const allSaved = wines.length > 0 && wines.every((w) => w.saved || !w.extractedData);
  const hasUnsavedWines = wines.some((w) => w.extractedData && !w.saved);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Wine Labels</CardTitle>
          <CardDescription>
            Upload up to {MAX_FILES} photos of wine labels to automatically extract details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wine-images">Wine Label Images ({wines.length}/{MAX_FILES})</Label>
            <Input
              id="wine-images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              ref={fileInputRef}
              disabled={wines.length >= MAX_FILES}
            />
            {wines.length >= MAX_FILES && (
              <p className="text-sm text-muted-foreground">
                Maximum of {MAX_FILES} images reached. Remove an image to add more.
              </p>
            )}
          </div>

          {wines.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={analyzeAll}
                disabled={analyzingAll || allAnalyzed}
                className="flex-1"
              >
                {analyzingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing All...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Analyze All Labels
                  </>
                )}
              </Button>
              {hasUnsavedWines && (
                <Button
                  onClick={saveAll}
                  disabled={savingAll || !hasUnsavedWines}
                  className="flex-1"
                >
                  {savingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving All...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save All Wines
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {wines.length > 0 && (
        <div className="space-y-4">
          {wines.map((wine, index) => (
            <Card key={index} className={wine.saved ? "border-green-500" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Wine {index + 1}
                      {wine.saved && (
                        <span className="ml-2 text-sm text-green-600 font-normal">
                          ✓ Saved
                        </span>
                      )}
                    </CardTitle>
                    {wine.error && (
                      <p className="text-sm text-destructive mt-1">{wine.error}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWine(index)}
                    disabled={wine.saving || wine.analyzing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                  <Image
                    src={wine.preview}
                    alt={`Wine label ${index + 1}`}
                    fill
                    className="object-contain"
                  />
                </div>

                {!wine.extractedData && !wine.analyzing && (
                  <Button
                    onClick={() => analyzeWine(index)}
                    disabled={wine.analyzing}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Analyze This Label
                  </Button>
                )}

                {wine.analyzing && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Analyzing...</span>
                  </div>
                )}

                {wine.extractedData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={wine.extractedData.name} readOnly />
                      </div>
                      {wine.extractedData.type && (
                        <div className="space-y-2">
                          <Label>Wine Type</Label>
                          <Input value={wine.extractedData.type} readOnly />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {wine.extractedData.grape && (
                        <div className="space-y-2">
                          <Label>Grape Varietal</Label>
                          <Input value={wine.extractedData.grape} readOnly />
                        </div>
                      )}
                      {wine.extractedData.country && (
                        <div className="space-y-2">
                          <Label>Country</Label>
                          <Input value={wine.extractedData.country} readOnly />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {wine.extractedData.region && (
                        <div className="space-y-2">
                          <Label>Region</Label>
                          <Input value={wine.extractedData.region} readOnly />
                        </div>
                      )}
                      {wine.extractedData.vintage && (
                        <div className="space-y-2">
                          <Label>Vintage</Label>
                          <Input value={wine.extractedData.vintage} readOnly />
                        </div>
                      )}
                    </div>

                    {wine.extractedData.notes && (
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input value={wine.extractedData.notes} readOnly />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`quantity-${index}`}>Quantity (bottles)</Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        min="1"
                        value={wine.quantity}
                        onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                        disabled={wine.saved}
                        required
                      />
                    </div>

                    <Button
                      onClick={() => saveWine(index)}
                      disabled={wine.saving || wine.saved}
                      className="w-full"
                    >
                      {wine.saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : wine.saved ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Saved
                        </>
                      ) : (
                        "Save to Cellar"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
