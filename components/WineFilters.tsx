"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { Wine } from "./WineCard";
import { cn } from "@/lib/utils";

// Sort wines: by country (alphabetically), then by name (alphabetically) within each country
function sortWinesByCountryAndName(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
    const countryA = a.country || "ZZZ_No Country";
    const countryB = b.country || "ZZZ_No Country";
    
    if (countryA !== countryB) {
      return countryA.localeCompare(countryB);
    }
    
    return (a.name || "").localeCompare(b.name || "");
  });
}

interface WineFiltersProps {
  wines: Wine[];
  onFilterChange: (filteredWines: Wine[]) => void;
}

export function WineFilters({ wines, onFilterChange }: WineFiltersProps) {
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedGrape, setSelectedGrape] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedVintage, setSelectedVintage] = useState<string>("all");
  const [scoreSort, setScoreSort] = useState<string>("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique values for filters
  const uniqueCountries = useMemo(() => {
    const countries = wines
      .map((w) => w.country)
      .filter((c): c is string => Boolean(c))
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .sort();
    return countries;
  }, [wines]);

  const uniqueGrapes = useMemo(() => {
    const grapes = wines
      .map((w) => w.grape)
      .filter((g): g is string => Boolean(g))
      .filter((g, i, arr) => arr.indexOf(g) === i)
      .sort();
    return grapes;
  }, [wines]);

  const uniqueTypes = useMemo(() => {
    const types = wines
      .map((w) => w.type)
      .filter((t): t is string => Boolean(t))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .sort();
    return types;
  }, [wines]);

  const uniqueVintages = useMemo(() => {
    const vintages = wines
      .map((w) => w.vintage)
      .filter((v): v is number => Boolean(v))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => b - a);
    return vintages;
  }, [wines]);

  // Apply filters
  useEffect(() => {
    let filtered = [...wines];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (wine) =>
          wine.name.toLowerCase().includes(query) ||
          wine.type?.toLowerCase().includes(query) ||
          wine.grape?.toLowerCase().includes(query) ||
          wine.region?.toLowerCase().includes(query) ||
          wine.country?.toLowerCase().includes(query) ||
          wine.notes?.toLowerCase().includes(query)
      );
    }

    if (selectedCountry !== "all") {
      filtered = filtered.filter((wine) => wine.country === selectedCountry);
    }

    if (selectedGrape !== "all") {
      filtered = filtered.filter((wine) => wine.grape === selectedGrape);
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((wine) => wine.type === selectedType);
    }

    if (selectedVintage !== "all") {
      const vintage = parseInt(selectedVintage);
      filtered = filtered.filter((wine) => wine.vintage === vintage);
    }

    let sortedFiltered: Wine[];
    
    if (scoreSort === "low-to-high") {
      sortedFiltered = [...filtered].sort((a, b) => {
        const scoreA = a.score ?? -1;
        const scoreB = b.score ?? -1;
        
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
        
        const countryA = a.country || "ZZZ_No Country";
        const countryB = b.country || "ZZZ_No Country";
        if (countryA !== countryB) {
          return countryA.localeCompare(countryB);
        }
        return (a.name || "").localeCompare(b.name || "");
      });
    } else if (scoreSort === "high-to-low") {
      sortedFiltered = [...filtered].sort((a, b) => {
        const scoreA = a.score ?? -1;
        const scoreB = b.score ?? -1;
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        
        const countryA = a.country || "ZZZ_No Country";
        const countryB = b.country || "ZZZ_No Country";
        if (countryA !== countryB) {
          return countryA.localeCompare(countryB);
        }
        return (a.name || "").localeCompare(b.name || "");
      });
    } else {
      sortedFiltered = sortWinesByCountryAndName(filtered);
    }
    
    onFilterChange(sortedFiltered);
  }, [wines, searchQuery, selectedCountry, selectedGrape, selectedType, selectedVintage, scoreSort, onFilterChange]);

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

  const clearFilters = () => {
    setSelectedCountry("all");
    setSelectedGrape("all");
    setSelectedType("all");
    setSelectedVintage("all");
    setScoreSort("default");
    setSearchQuery("");
  };

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
          <ChevronDown className={cn(
            "w-4 h-4 ml-2 transition-transform",
            showFilters && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Collapsible Filters */}
      <div className={cn(
        "grid gap-3 transition-all duration-300 overflow-hidden",
        showFilters ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
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
            <Select value={scoreSort} onValueChange={setScoreSort}>
              <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-0">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="high-to-low">Rating: High → Low</SelectItem>
                <SelectItem value="low-to-high">Rating: Low → High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
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
}
