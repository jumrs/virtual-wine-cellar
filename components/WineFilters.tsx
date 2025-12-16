"use client";

import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search, SlidersHorizontal, ChevronDown, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks";
import {
  sortWinesByCountryAndName,
  sortWinesByScoreAsc,
  sortWinesByScoreDesc,
  sortWinesByDateDesc,
  filterWinesByQuery,
} from "@/lib/wineUtils";
import type { Wine, SortOption } from "@/types";

const STORAGE_KEY = "wine-filters-persistent";

interface PersistentFilters {
  selectedCountry: string;
  selectedGrape: string;
  selectedType: string;
  selectedVintage: string;
  scoreSort: string;
  searchQuery: string;
}

interface WineFiltersProps {
  wines: Wine[];
  onFilterChange: (filteredWines: Wine[]) => void;
}

/** Load filters from localStorage */
function loadPersistentFilters(): PersistentFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/** Save filters to localStorage */
function savePersistentFilters(filters: PersistentFilters): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
}

/** Clear filters from localStorage */
function clearPersistentFilters(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export const WineFilters = memo(function WineFilters({
  wines,
  onFilterChange,
}: WineFiltersProps) {
  // Load persistent filters once on mount
  const persistentFiltersRef = useRef<PersistentFilters | null>(null);
  if (persistentFiltersRef.current === null) {
    persistentFiltersRef.current = loadPersistentFilters();
  }
  const persistentFilters = persistentFiltersRef.current;

  // Filter state
  const [selectedCountry, setSelectedCountry] = useState(
    persistentFilters?.selectedCountry || "all"
  );
  const [selectedGrape, setSelectedGrape] = useState(
    persistentFilters?.selectedGrape || "all"
  );
  const [selectedType, setSelectedType] = useState(
    persistentFilters?.selectedType || "all"
  );
  const [selectedVintage, setSelectedVintage] = useState(
    persistentFilters?.selectedVintage || "all"
  );
  const [scoreSort, setScoreSort] = useState<SortOption | "default">(
    (persistentFilters?.scoreSort as SortOption) || "default"
  );
  const [searchQuery, setSearchQuery] = useState(persistentFilters?.searchQuery || "");
  const [showFilters, setShowFilters] = useState(false);
  const [isPersistent, setIsPersistent] = useState(!!persistentFilters);

  // Debounce search query for better performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Extract unique values with useMemo
  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>();
    wines.forEach((w) => {
      if (w.country) countries.add(w.country);
    });
    return Array.from(countries).sort();
  }, [wines]);

  const uniqueGrapes = useMemo(() => {
    const grapeSet = new Set<string>();
    wines.forEach((w) => {
      if (w.grapes?.length) {
        w.grapes.forEach((g) => grapeSet.add(g));
      } else if (w.grape) {
        w.grape
          .split(/[\/,+]|\s+and\s+/i)
          .map((g) => g.trim())
          .filter(Boolean)
          .forEach((g) => grapeSet.add(g));
      }
    });
    return Array.from(grapeSet).sort();
  }, [wines]);

  const blendCount = useMemo(
    () => wines.filter((w) => w.is_blend || (w.grapes && w.grapes.length > 1)).length,
    [wines]
  );

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    wines.forEach((w) => {
      if (w.type) types.add(w.type);
    });
    return Array.from(types).sort();
  }, [wines]);

  const uniqueVintages = useMemo(() => {
    const vintages = new Set<number>();
    wines.forEach((w) => {
      if (w.vintage) vintages.add(w.vintage);
    });
    return Array.from(vintages).sort((a, b) => b - a);
  }, [wines]);

  // Apply filters with memoized callback
  const applyFilters = useCallback(() => {
    let filtered = [...wines];

    // Apply search filter
    if (debouncedSearch) {
      filtered = filterWinesByQuery(filtered, debouncedSearch);
    }

    // Apply country filter
    if (selectedCountry !== "all") {
      filtered = filtered.filter((w) => w.country === selectedCountry);
    }

    // Apply grape filter
    if (selectedGrape !== "all") {
      if (selectedGrape === "blend") {
        filtered = filtered.filter(
          (w) => w.is_blend || (w.grapes && w.grapes.length > 1)
        );
      } else {
        filtered = filtered.filter((w) => {
          if (w.grapes?.length) {
            return w.grapes.some(
              (g) => g.toLowerCase() === selectedGrape.toLowerCase()
            );
          }
          if (w.grape) {
            const grapes = w.grape
              .split(/[\/,+]|\s+and\s+/i)
              .map((g) => g.trim().toLowerCase());
            return grapes.includes(selectedGrape.toLowerCase());
          }
          return false;
        });
      }
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((w) => w.type === selectedType);
    }

    // Apply vintage filter
    if (selectedVintage !== "all") {
      const vintage = parseInt(selectedVintage);
      filtered = filtered.filter((w) => w.vintage === vintage);
    }

    // Apply sorting
    switch (scoreSort) {
      case "high-to-low":
        filtered = sortWinesByScoreDesc(filtered);
        break;
      case "low-to-high":
        filtered = sortWinesByScoreAsc(filtered);
        break;
      case "last-added":
        filtered = sortWinesByDateDesc(filtered);
        break;
      default:
        filtered = sortWinesByCountryAndName(filtered);
    }

    return filtered;
  }, [
    wines,
    debouncedSearch,
    selectedCountry,
    selectedGrape,
    selectedType,
    selectedVintage,
    scoreSort,
  ]);

  // Apply filters when dependencies change
  useEffect(() => {
    const filtered = applyFilters();
    onFilterChange(filtered);
  }, [applyFilters, onFilterChange]);

  // Save to localStorage when persistent mode is enabled
  useEffect(() => {
    if (isPersistent) {
      savePersistentFilters({
        selectedCountry,
        selectedGrape,
        selectedType,
        selectedVintage,
        scoreSort,
        searchQuery,
      });
    }
  }, [
    isPersistent,
    selectedCountry,
    selectedGrape,
    selectedType,
    selectedVintage,
    scoreSort,
    searchQuery,
  ]);

  const hasActiveFilters =
    selectedCountry !== "all" ||
    selectedGrape !== "all" ||
    selectedType !== "all" ||
    selectedVintage !== "all" ||
    scoreSort !== "default" ||
    searchQuery !== "";

  const activeFilterCount = [
    selectedCountry !== "all",
    selectedGrape !== "all",
    selectedType !== "all",
    selectedVintage !== "all",
    scoreSort !== "default",
  ].filter(Boolean).length;

  const togglePersistence = useCallback(() => {
    setIsPersistent((prev) => {
      const newValue = !prev;
      if (!newValue) {
        clearPersistentFilters();
      }
      return newValue;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCountry("all");
    setSelectedGrape("all");
    setSelectedType("all");
    setSelectedVintage("all");
    setScoreSort("default");
    setSearchQuery("");
    if (isPersistent) {
      clearPersistentFilters();
      setIsPersistent(false);
    }
  }, [isPersistent]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search wines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 elegant-input h-11"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          className={cn(
            "h-11 px-4 rounded-xl relative",
            hasActiveFilters && "border-primary text-primary"
          )}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 ml-2 transition-transform",
              showFilters && "rotate-180"
            )}
          />
        </Button>
        {hasActiveFilters && (
          <Button
            variant={isPersistent ? "default" : "outline"}
            size="icon"
            className={cn(
              "h-11 w-11 rounded-xl",
              isPersistent && "bg-primary text-primary-foreground"
            )}
            onClick={togglePersistence}
            title={
              isPersistent ? "Filters saved. Click to unsave." : "Save filters"
            }
          >
            {isPersistent ? (
              <Pin className="w-4 h-4" />
            ) : (
              <PinOff className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Collapsible Filters */}
      <div
        className={cn(
          "grid gap-3 transition-all duration-300 overflow-hidden",
          showFilters ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Country Filter */}
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-0">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {uniqueCountries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-0">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Grape Filter */}
            <Select value={selectedGrape} onValueChange={setSelectedGrape}>
              <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-0">
                <SelectValue placeholder="Grape" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grapes</SelectItem>
                {blendCount > 0 && (
                  <SelectItem value="blend">Blends ({blendCount})</SelectItem>
                )}
                {uniqueGrapes.map((grape) => (
                  <SelectItem key={grape} value={grape}>
                    {grape}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Vintage Filter */}
            {uniqueVintages.length > 0 && (
              <Select value={selectedVintage} onValueChange={setSelectedVintage}>
                <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-0">
                  <SelectValue placeholder="Vintage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vintages</SelectItem>
                  {uniqueVintages.map((vintage) => (
                    <SelectItem key={vintage} value={vintage.toString()}>
                      {vintage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Score Sort */}
            <Select
              value={scoreSort}
              onValueChange={(v) => setScoreSort(v as SortOption | "default")}
            >
              <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-0">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="last-added">Last Added</SelectItem>
                <SelectItem value="high-to-low">Rating: High → Low</SelectItem>
                <SelectItem value="low-to-high">Rating: Low → High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
