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
    
    return Object.entries(countryCount)
      .map(([name, value]) => ({ 
        name, 
        value,
        flag: COUNTRY_FLAGS[name] || "🍷",
      }))
      .sort((a, b) => b.value - a.value);
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
          <DialogDescription>
            Explore the geographic diversity of your collection
          </DialogDescription>
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

        {/* Charts Container */}
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Country Distribution Pie */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Flag className="w-4 h-4 text-primary" />
              Distribution
            </h3>
            <div className="h-[200px] w-full">
              {countryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={countryData.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => 
                        percent > 0.08 ? name : ''
                      }
                      labelLine={false}
                    >
                      {countryData.slice(0, 8).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name, props) => [
                        `${value} wines (${Math.round((value / wines.length) * 100)}%)`,
                        `${props.payload.flag} ${name}`
                      ]}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No country data available
                </div>
              )}
            </div>
          </div>

          {/* Country Bar Chart */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Wine Count by Country
            </h3>
            <div className="h-[200px] w-full">
              {countryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={countryData.slice(0, 7)} 
                    layout="vertical"
                    margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name"
                      width={80}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${COUNTRY_FLAGS[value] || '🍷'} ${value.slice(0, 8)}${value.length > 8 ? '..' : ''}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} wines`, 'Count']}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="hsl(348, 83%, 47%)"
                      radius={[0, 6, 6, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Country List */}
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium">Full Breakdown</h3>
          <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
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

