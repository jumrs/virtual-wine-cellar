"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, Check, Search, Grape, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_GRAPES, GRAPE_CATEGORIES } from "@/lib/grapeVarieties";

interface GrapeSelectorProps {
  value: string[];
  onChange: (grapes: string[]) => void;
  isBlend?: boolean;
  onBlendChange?: (isBlend: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function GrapeSelector({
  value = [],
  onChange,
  isBlend = false,
  onBlendChange,
  disabled = false,
  className,
}: GrapeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customGrape, setCustomGrape] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update blend status when grapes change
  useEffect(() => {
    if (onBlendChange) {
      onBlendChange(value.length > 1);
    }
  }, [value, onBlendChange]);

  const filteredGrapes = searchQuery
    ? ALL_GRAPES.filter((grape) =>
        grape.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_GRAPES;

  const handleSelect = (grape: string) => {
    if (value.includes(grape)) {
      onChange(value.filter((g) => g !== grape));
    } else {
      onChange([...value, grape]);
    }
    setSearchQuery("");
  };

  const handleRemove = (grape: string) => {
    onChange(value.filter((g) => g !== grape));
  };

  const handleAddCustom = () => {
    const trimmed = customGrape.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setCustomGrape("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredGrapes.length > 0 && searchQuery) {
        handleSelect(filteredGrapes[0]);
      }
    }
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      {/* Blend Toggle */}
      {value.length > 1 && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Grape className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">Blend</span>
          <span className="text-xs text-amber-600">({value.length} grapes)</span>
        </div>
      )}

      {/* Selected Grapes Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((grape) => (
            <span
              key={grape}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-sm rounded-full"
            >
              {grape}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(grape)}
                  className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown Trigger */}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 bg-background border rounded-xl",
              "hover:border-primary/50 transition-colors text-left",
              isOpen && "border-primary ring-1 ring-primary/20"
            )}
          >
            <span className={cn("text-sm", value.length === 0 && "text-muted-foreground")}>
              {value.length === 0
                ? "Select grape varieties..."
                : `${value.length} grape${value.length > 1 ? "s" : ""} selected`}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </button>

          {/* Dropdown Content */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-lg overflow-hidden">
              {/* Search Input */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search grapes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9 h-9 border-0 bg-muted/50 focus-visible:ring-1"
                    autoFocus
                  />
                </div>
              </div>

              {/* Grape List */}
              <div className="max-h-60 overflow-y-auto p-1">
                {filteredGrapes.length > 0 ? (
                  filteredGrapes.map((grape) => {
                    const isSelected = value.includes(grape);
                    return (
                      <button
                        key={grape}
                        type="button"
                        onClick={() => handleSelect(grape)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left",
                          "hover:bg-muted transition-colors",
                          isSelected && "bg-primary/10 text-primary"
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-border"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        {grape}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No grapes found matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>

              {/* Add Custom Grape */}
              <div className="p-2 border-t">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Add custom grape..."
                    value={customGrape}
                    onChange={(e) => setCustomGrape(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustom();
                      }
                    }}
                    className="h-9 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleAddCustom}
                    disabled={!customGrape.trim()}
                    className="h-9 px-3"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State for disabled */}
      {disabled && value.length === 0 && (
        <div className="text-sm text-muted-foreground">No grapes specified</div>
      )}
    </div>
  );
}

// Simple single grape selector for backwards compatibility
interface SingleGrapeSelectorProps {
  value: string;
  onChange: (grape: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SingleGrapeSelector({
  value = "",
  onChange,
  disabled = false,
  className,
}: SingleGrapeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredGrapes = searchQuery
    ? ALL_GRAPES.filter((grape) =>
        grape.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_GRAPES;

  const handleSelect = (grape: string) => {
    onChange(grape);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 bg-background border rounded-xl",
          "hover:border-primary/50 transition-colors text-left",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "border-primary ring-1 ring-primary/20"
        )}
      >
        <span className={cn("text-sm", !value && "text-muted-foreground")}>
          {value || "Select a grape..."}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search grapes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 border-0 bg-muted/50 focus-visible:ring-1"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
                Clear selection
              </button>
            )}
            
            {filteredGrapes.map((grape) => (
              <button
                key={grape}
                type="button"
                onClick={() => handleSelect(grape)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left",
                  "hover:bg-muted transition-colors",
                  value === grape && "bg-primary/10 text-primary"
                )}
              >
                {value === grape && <Check className="w-4 h-4" />}
                {grape}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

