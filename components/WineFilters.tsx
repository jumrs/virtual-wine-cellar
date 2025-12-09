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
import { X, Filter } from "lucide-react";
import type { Wine } from "./WineCard";

// Sort wines: by country (alphabetically), then by name (alphabetically) within each country
function sortWinesByCountryAndName(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
    // Handle wines without country - put them at the end
    const countryA = a.country || "ZZZ_No Country";
    const countryB = b.country || "ZZZ_No Country";
    
    // First sort by country
    if (countryA !== countryB) {
      return countryA.localeCompare(countryB);
    }
    
    // If same country, sort by name
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
  const [searchQuery, setSearchQuery] = useState("");

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
      .sort((a, b) => b - a); // Sort descending (newest first)
    return vintages;
  }, [wines]);

  // Apply filters
  useEffect(() => {
    let filtered = [...wines];

    // Search filter
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

    // Country filter
    if (selectedCountry !== "all") {
      filtered = filtered.filter((wine) => wine.country === selectedCountry);
    }

    // Grape filter
    if (selectedGrape !== "all") {
      filtered = filtered.filter((wine) => wine.grape === selectedGrape);
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((wine) => wine.type === selectedType);
    }

    // Vintage filter
    if (selectedVintage !== "all") {
      const vintage = parseInt(selectedVintage);
      filtered = filtered.filter((wine) => wine.vintage === vintage);
    }

    // Sort filtered wines: by country (alphabetically), then by name (alphabetically) within each country
    const sortedFiltered = sortWinesByCountryAndName(filtered);
    
    onFilterChange(sortedFiltered);
  }, [wines, searchQuery, selectedCountry, selectedGrape, selectedType, selectedVintage, onFilterChange]);

  const hasActiveFilters =
    selectedCountry !== "all" ||
    selectedGrape !== "all" ||
    selectedType !== "all" ||
    selectedVintage !== "all" ||
    searchQuery !== "";

  const clearFilters = () => {
    setSelectedCountry("all");
    setSelectedGrape("all");
    setSelectedType("all");
    setSelectedVintage("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Filters</h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <Input
            placeholder="Search wines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Country Filter */}
        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
          <SelectTrigger>
            <SelectValue placeholder="All Countries" />
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
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
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
          <SelectTrigger>
            <SelectValue placeholder="All Grapes" />
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
      </div>

      {/* Vintage Filter */}
      {uniqueVintages.length > 0 && (
        <div>
          <Select value={selectedVintage} onValueChange={setSelectedVintage}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="All Vintages" />
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
        </div>
      )}
    </div>
  );
}

