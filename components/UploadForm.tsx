"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, X, Check, Camera, Wine, ImagePlus, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { cn } from "@/lib/utils";

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
      
      setWines((prevWines) => {
        const updated = prevWines.map((w, i) => 
          i === index ? { ...w, extractedData: data, analyzing: false } : w
        );
        winesRef.current = updated;
        return updated;
      });
      
      toast({
        title: "Wine recognized!",
        description: `"${data.name}" has been identified.`,
      });
    } catch (error: any) {
      console.error("Analyze error:", error);
      setWines((prevWines) => {
        const updated = prevWines.map((w, i) => 
          i === index ? { ...w, analyzing: false, error: error.message } : w
        );
        winesRef.current = updated;
        return updated;
      });
      toast({
        title: "Recognition failed",
        description: error.message || "Failed to analyze wine label. Please try again.",
        variant: "destructive",
      });
    }
  };

  const analyzeAll = async () => {
    if (analyzingAll) return;
    setAnalyzingAll(true);
    
    try {
      const indicesToAnalyze = winesRef.current
        .map((w, idx) => ({ wine: w, index: idx }))
        .filter(({ wine }) => !wine.extractedData && !wine.analyzing)
        .map(({ index }) => index);
      
      for (let i = 0; i < indicesToAnalyze.length; i++) {
        const index = indicesToAnalyze[i];
        
        if (winesRef.current[index] && !winesRef.current[index].extractedData && !winesRef.current[index].analyzing) {
          await analyzeWine(index);
          
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
        title: "Added to cellar!",
        description: `"${wine.extractedData.name}" is now in your collection.`,
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
        if (i < winesToSave.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    setSavingAll(false);
    
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
  const hasUnsavedWines = wines.some((w) => w.extractedData && !w.saved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold font-serif mb-2">Scan Wine Labels</h1>
        <p className="text-muted-foreground">
          Take a photo or upload up to {MAX_FILES} wine labels
        </p>
      </div>

      {/* Upload Area */}
      {wines.length === 0 ? (
        <div className="relative">
          {/* Camera-style frame */}
          <div className="aspect-[3/4] max-w-sm mx-auto bg-gradient-to-b from-muted to-muted/50 rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <div className="w-20 h-20 rounded-full bg-white/80 backdrop-blur flex items-center justify-center mb-6 shadow-lg">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <p className="text-center font-medium mb-2">Align label within frame</p>
              <p className="text-center text-sm text-muted-foreground mb-6">
                Position the wine label clearly visible
              </p>
              
              <input
                id="wine-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full btn-wine px-6"
              >
                <ImagePlus className="w-5 h-5 mr-2" />
                Choose Photos
              </Button>
            </div>

            {/* Frame corners */}
            <div className="absolute top-8 left-8 w-12 h-12 border-l-2 border-t-2 border-primary rounded-tl-lg" />
            <div className="absolute top-8 right-8 w-12 h-12 border-r-2 border-t-2 border-primary rounded-tr-lg" />
            <div className="absolute bottom-8 left-8 w-12 h-12 border-l-2 border-b-2 border-primary rounded-bl-lg" />
            <div className="absolute bottom-8 right-8 w-12 h-12 border-r-2 border-b-2 border-primary rounded-br-lg" />
          </div>

          {/* Capture button style */}
          <div className="flex justify-center mt-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-full bg-white border-4 border-primary flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Batch Actions */}
          <div className="flex gap-3">
            <Button
              onClick={analyzeAll}
              disabled={analyzingAll || allAnalyzed}
              className="flex-1 h-12 rounded-xl"
              variant={allAnalyzed ? "secondary" : "default"}
            >
              {analyzingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze All
                </>
              )}
            </Button>
            {hasUnsavedWines && (
              <Button
                onClick={saveAll}
                disabled={savingAll || !hasUnsavedWines}
                className="flex-1 h-12 rounded-xl btn-wine"
              >
                {savingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save All
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Add more */}
          {wines.length < MAX_FILES && (
            <div className="flex justify-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full"
              >
                <ImagePlus className="w-4 h-4 mr-2" />
                Add More ({wines.length}/{MAX_FILES})
              </Button>
            </div>
          )}

          {/* Wine Cards */}
          <div className="space-y-4">
            {wines.map((wine, index) => (
              <div 
                key={index} 
                className={cn(
                  "wine-card p-4",
                  wine.saved && "ring-2 ring-green-500 ring-offset-2"
                )}
              >
                <div className="flex gap-4">
                  {/* Image Preview */}
                  <div className="relative w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                    <Image
                      src={wine.preview}
                      alt={`Wine label ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    {wine.saved && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        {wine.extractedData ? (
                          <>
                            <h3 className="font-semibold truncate">{wine.extractedData.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {wine.extractedData.vintage && `${wine.extractedData.vintage} • `}
                              {wine.extractedData.region || wine.extractedData.country || "Unknown"}
                            </p>
                          </>
                        ) : (
                          <>
                            <h3 className="font-semibold">Wine {index + 1}</h3>
                            <p className="text-sm text-muted-foreground">
                              {wine.analyzing ? "Analyzing..." : "Ready to analyze"}
                            </p>
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWine(index)}
                        disabled={wine.saving || wine.analyzing}
                        className="h-8 w-8 rounded-full flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {wine.error && (
                      <p className="text-sm text-destructive mb-2">{wine.error}</p>
                    )}

                    {wine.analyzing && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Recognizing label...</span>
                      </div>
                    )}

                    {wine.extractedData && !wine.saved && (
                      <div className="space-y-3">
                        {/* Wine details grid */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {wine.extractedData.type && (
                            <div>
                              <span className="text-muted-foreground">Type:</span>{" "}
                              <span className="font-medium">{wine.extractedData.type}</span>
                            </div>
                          )}
                          {wine.extractedData.grape && (
                            <div>
                              <span className="text-muted-foreground">Grape:</span>{" "}
                              <span className="font-medium">{wine.extractedData.grape}</span>
                            </div>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center gap-3">
                          <Label htmlFor={`quantity-${index}`} className="text-sm">
                            Bottles:
                          </Label>
                          <Input
                            id={`quantity-${index}`}
                            type="number"
                            min="1"
                            value={wine.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                            disabled={wine.saved}
                            className="w-20 h-9 elegant-input text-center"
                          />
                        </div>

                        {/* Save button */}
                        <Button
                          onClick={() => saveWine(index)}
                          disabled={wine.saving || wine.saved}
                          className="w-full h-10 rounded-xl btn-wine"
                        >
                          {wine.saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Wine className="h-4 w-4 mr-2" />
                              Add to Cellar
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {!wine.extractedData && !wine.analyzing && (
                      <Button
                        onClick={() => analyzeWine(index)}
                        disabled={wine.analyzing}
                        className="w-full h-10 rounded-xl mt-2"
                        variant="outline"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze Label
                      </Button>
                    )}

                    {wine.saved && (
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <Check className="h-4 w-4" />
                        <span>Saved to your cellar</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
