/**
 * Wine Utility Functions
 * Shared helpers for wine data processing, sorting, and formatting
 */

import type { Wine, WineTypeBadge } from "@/types";

/** Country name to ISO code mapping */
const COUNTRY_CODES: Record<string, string> = {
  // Europe
  france: "FR",
  italy: "IT",
  spain: "ES",
  portugal: "PT",
  germany: "DE",
  austria: "AT",
  switzerland: "CH",
  greece: "GR",
  croatia: "HR",
  slovenia: "SI",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  georgia: "GE",
  turkey: "TR",
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  ireland: "IE",
  russia: "RU",
  ukraine: "UA",
  poland: "PL",
  "czech republic": "CZ",
  slovakia: "SK",
  moldova: "MD",
  serbia: "RS",
  montenegro: "ME",
  macedonia: "MK",
  bosnia: "BA",
  albania: "AL",
  cyprus: "CY",
  malta: "MT",
  luxembourg: "LU",
  belgium: "BE",
  netherlands: "NL",
  denmark: "DK",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  iceland: "IS",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  belarus: "BY",
  // Americas
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  canada: "CA",
  mexico: "MX",
  argentina: "AR",
  chile: "CL",
  brazil: "BR",
  uruguay: "UY",
  // Africa & Middle East
  "south africa": "ZA",
  morocco: "MA",
  tunisia: "TN",
  algeria: "DZ",
  egypt: "EG",
  israel: "IL",
  lebanon: "LB",
  // Asia & Oceania
  australia: "AU",
  "new zealand": "NZ",
  china: "CN",
  japan: "JP",
  india: "IN",
};

/**
 * Get ISO country code from country name
 * @param country - Country name to look up
 * @returns ISO 2-letter country code or empty string if not found
 */
export function getCountryCode(country?: string): string {
  if (!country) return "";
  return COUNTRY_CODES[country.toLowerCase().trim()] || "";
}

/**
 * Sort wines by country (alphabetically), then by name within each country
 * @param wines - Array of wines to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortWinesByCountryAndName(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
    const countryA = a.country || "ZZZ_No Country";
    const countryB = b.country || "ZZZ_No Country";

    if (countryA !== countryB) {
      return countryA.localeCompare(countryB);
    }

    return (a.name || "").localeCompare(b.name || "");
  });
}

/**
 * Sort wines by score (high to low), then by country and name
 */
export function sortWinesByScoreDesc(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
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
}

/**
 * Sort wines by score (low to high), then by country and name
 */
export function sortWinesByScoreAsc(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
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
}

/**
 * Sort wines by date added (most recent first)
 */
export function sortWinesByDateDesc(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => {
    const dateA = a.date_added ? new Date(a.date_added).getTime() : 0;
    const dateB = b.date_added ? new Date(b.date_added).getTime() : 0;
    return dateB - dateA;
  });
}

/**
 * Get wine type badge variant based on wine type
 * @param type - Wine type string
 * @returns Badge variant for styling
 */
export function getWineTypeBadge(type?: string): WineTypeBadge {
  if (!type) return "default";
  const lowerType = type.toLowerCase();

  if (lowerType.includes("red")) return "red";
  if (lowerType.includes("white")) return "white";
  if (lowerType.includes("rosé") || lowerType.includes("rose")) return "rose";
  if (lowerType.includes("sparkling") || lowerType.includes("champagne")) return "sparkling";

  return "default";
}

/**
 * Get CSS class for wine type badge
 * @param type - Wine type string
 * @returns Tailwind CSS classes for the badge
 */
export function getWineTypeBadgeClass(type?: string): string {
  const badge = getWineTypeBadge(type);
  const classes: Record<WineTypeBadge, string> = {
    red: "wine-badge-red",
    white: "wine-badge-white",
    rose: "wine-badge-rose",
    sparkling: "wine-badge-sparkling",
    default: "bg-muted text-muted-foreground",
  };
  return classes[badge];
}

/**
 * Filter wines by search query (searches multiple fields)
 * @param wines - Array of wines to filter
 * @param query - Search query string
 * @returns Filtered array of wines
 */
export function filterWinesByQuery(wines: Wine[], query: string): Wine[] {
  if (!query.trim()) return wines;

  const lowerQuery = query.toLowerCase();
  return wines.filter(
    (wine) =>
      wine.name.toLowerCase().includes(lowerQuery) ||
      wine.type?.toLowerCase().includes(lowerQuery) ||
      wine.grape?.toLowerCase().includes(lowerQuery) ||
      wine.grapes?.some((g) => g.toLowerCase().includes(lowerQuery)) ||
      wine.region?.toLowerCase().includes(lowerQuery) ||
      wine.country?.toLowerCase().includes(lowerQuery) ||
      wine.notes?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Separate wines into active (quantity > 0) and ran out (quantity === 0)
 * @param wines - Array of wines
 * @returns Object with active and ranOut wine arrays
 */
export function separateWinesByQuantity(wines: Wine[]): {
  active: Wine[];
  ranOut: Wine[];
} {
  return {
    active: wines.filter((w) => (w.quantity || 0) > 0),
    ranOut: wines.filter((w) => (w.quantity || 0) === 0),
  };
}

/**
 * Calculate wine collection statistics
 * @param wines - Array of wines
 * @returns Statistics object
 */
export function calculateWineStats(wines: Wine[]) {
  const ratedWines = wines.filter((w) => w.score !== null && w.score !== undefined);
  const uniqueCountries = new Set(wines.map((w) => w.country).filter(Boolean));

  return {
    totalWines: wines.length,
    totalBottles: wines.reduce((sum, w) => sum + (w.quantity || 0), 0),
    ratedCount: ratedWines.length,
    avgRating:
      ratedWines.length > 0
        ? ratedWines.reduce((sum, w) => sum + (w.score || 0), 0) / ratedWines.length
        : 0,
    uniqueCountries: uniqueCountries.size,
    activeWines: wines.filter((w) => (w.quantity || 0) > 0).length,
  };
}

/**
 * Check if wine is premium (high rated)
 * @param wine - Wine to check
 * @param threshold - Score threshold (default 4.5)
 * @returns True if wine score meets threshold
 */
export function isPremiumWine(wine: Wine, threshold = 4.5): boolean {
  return wine.score !== null && wine.score !== undefined && wine.score >= threshold;
}

