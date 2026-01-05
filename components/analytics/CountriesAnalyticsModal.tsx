"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wine } from "@/components/WineCard";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Globe, MapPin, Flag } from "lucide-react";

interface CountriesAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wines: Wine[];
}

const COLORS = [
  "hsl(348, 83%, 47%)", // wine red
  "hsl(345, 70%, 35%)", // burgundy  
  "hsl(45, 80%, 50%)",  // gold
  "hsl(200, 70%, 50%)", // blue
  "hsl(150, 60%, 45%)", // green
  "hsl(280, 60%, 55%)", // purple
  "hsl(30, 70%, 50%)",  // orange
  "hsl(180, 50%, 45%)", // teal
  "hsl(320, 60%, 50%)", // pink
  "hsl(100, 50%, 45%)", // lime
];

// Country flag emojis
const COUNTRY_FLAGS: Record<string, string> = {
  "France": "🇫🇷",
  "Italy": "🇮🇹",
  "Spain": "🇪🇸",
  "Portugal": "🇵🇹",
  "Germany": "🇩🇪",
  "Austria": "🇦🇹",
  "USA": "🇺🇸",
  "United States": "🇺🇸",
  "Argentina": "🇦🇷",
  "Chile": "🇨🇱",
  "Australia": "🇦🇺",
  "New Zealand": "🇳🇿",
  "South Africa": "🇿🇦",
  "Greece": "🇬🇷",
  "Croatia": "🇭🇷",
  "Hungary": "🇭🇺",
  "Georgia": "🇬🇪",
  "Lebanon": "🇱🇧",
  "Israel": "🇮🇱",
  "Canada": "🇨🇦",
  "Mexico": "🇲🇽",
  "Brazil": "🇧🇷",
  "Uruguay": "🇺🇾",
  "Switzerland": "🇨🇭",
};

export function CountriesAnalyticsModal({ open, onOpenChange, wines }: CountriesAnalyticsModalProps) {
  // Calculate country distribution
  const countryData = useMemo(() => {
    const countryCount: Record<string, number> = {};
    wines.forEach((wine) => {
      const country = wine.country || "Unknown";
      countryCount[country] = (countryCount[country] || 0) + 1;
    });

    const sortedCountries = Object.entries(countryCount)
      .map(([name, value]) => ({
        name,
        value,
        flag: COUNTRY_FLAGS[name] || "🍷",
      }))
      .sort((a, b) => b.value - a.value);

    // Reorder for column-wise display: first column, then second column
    const reordered: typeof sortedCountries = [];
    const midPoint = Math.ceil(sortedCountries.length / 2);

    for (let i = 0; i < midPoint; i++) {
      reordered.push(sortedCountries[i]); // First column items
      if (i + midPoint < sortedCountries.length) {
        reordered.push(sortedCountries[i + midPoint]); // Second column items
      }
    }

    return reordered;
  }, [wines]);

  // Calculate regions within top country
  const topCountryRegions = useMemo(() => {
    if (countryData.length === 0) return [];
    
    const topCountry = countryData[0].name;
    const regionCount: Record<string, number> = {};
    
    wines
      .filter(w => w.country === topCountry && w.region)
      .forEach(wine => {
        const region = wine.region!;
        regionCount[region] = (regionCount[region] || 0) + 1;
      });
    
    return Object.entries(regionCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [wines, countryData]);

  // Stats
  const stats = useMemo(() => {
    const totalCountries = countryData.length;
    const topCountry = countryData[0];
    const percentage = topCountry && wines.length > 0 
      ? Math.round((topCountry.value / wines.length) * 100)
      : 0;
    
    return {
      totalCountries,
      topCountry,
      percentage,
    };
  }, [countryData, wines]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Your Wines by Country
          </DialogTitle>
        </DialogHeader>

        {/* Insights */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-1">
          {stats.topCountry && (
            <p className="text-sm">
              <span className="font-medium">
                Your largest region is {stats.topCountry.flag} {stats.topCountry.name}
              </span>
              {" "}— representing {stats.percentage}% of your collection.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            You have wines from <span className="font-medium text-foreground">{stats.totalCountries} countries</span>.
          </p>
        </div>

        {/* Country List */}
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
            {countryData.map((country, index) => (
              <div
                key={country.name}
                className="flex items-center justify-between py-1.5 px-3 bg-muted/20 rounded-lg text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span className="truncate">{country.name}</span>
                </div>
                <span className="font-medium text-primary">{country.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Country Regions */}
        {topCountryRegions.length > 0 && stats.topCountry && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium">
              Top Regions in {stats.topCountry.flag} {stats.topCountry.name}
            </h3>
            <div className="flex flex-wrap gap-2">
              {topCountryRegions.map((region) => (
                <span 
                  key={region.name}
                  className="px-3 py-1.5 bg-primary/10 text-primary text-xs rounded-full font-medium"
                >
                  {region.name} ({region.value})
                </span>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

