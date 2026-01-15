"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wine } from "@/components/WineCard";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Star, TrendingUp, Award, Wine as WineIcon } from "lucide-react";
import Image from "next/image";

interface RatingAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wines: Wine[];
}

export function RatingAnalyticsModal({ open, onOpenChange, wines }: RatingAnalyticsModalProps) {
  const [selectedRange, setSelectedRange] = useState<string | null>(null);

  // Filter out ran out wines (quantity must be > 0)
  const activeWines = useMemo(() => {
    return wines.filter((w) => {
      const qty = w.quantity ?? 0;
      return qty > 0;
    });
  }, [wines]);

  // Calculate detailed rating breakdown for each range
  const getRatingBreakdown = (range: string) => {
    const breakdown: Record<string, number> = {};
    
    activeWines.forEach((wine) => {
      const score = wine.score;
      if (score === null || score === undefined) return;
      
      let inRange = false;
      if (range === "5.0" && score >= 5.0) inRange = true;
      else if (range === "4.5-4.9" && score >= 4.5 && score < 5.0) inRange = true;
      else if (range === "4.0-4.4" && score >= 4.0 && score < 4.5) inRange = true;
      else if (range === "3.5-3.9" && score >= 3.5 && score < 4.0) inRange = true;
      else if (range === "3.0-3.4" && score >= 3.0 && score < 3.5) inRange = true;
      else if (range === "2.0-2.9" && score >= 2.0 && score < 3.0) inRange = true;
      else if (range === "1.0-1.9" && score >= 1.0 && score < 2.0) inRange = true;
      
      if (inRange) {
        const rounded = score.toFixed(1);
        breakdown[rounded] = (breakdown[rounded] || 0) + 1;
      }
    });
    
    return Object.entries(breakdown)
      .map(([rating, count]) => ({ rating: parseFloat(rating), count }))
      .sort((a, b) => b.rating - a.rating);
  };

  // Calculate rating distribution
  const ratingData = useMemo(() => {
    const ratingBuckets: Record<string, number> = {
      "1.0-1.9": 0,
      "2.0-2.9": 0,
      "3.0-3.4": 0,
      "3.5-3.9": 0,
      "4.0-4.4": 0,
      "4.5-4.9": 0,
      "5.0": 0,
    };
    
    activeWines.forEach((wine) => {
      const score = wine.score;
      if (score === null || score === undefined) return;
      
      if (score >= 5.0) ratingBuckets["5.0"]++;
      else if (score >= 4.5) ratingBuckets["4.5-4.9"]++;
      else if (score >= 4.0) ratingBuckets["4.0-4.4"]++;
      else if (score >= 3.5) ratingBuckets["3.5-3.9"]++;
      else if (score >= 3.0) ratingBuckets["3.0-3.4"]++;
      else if (score >= 2.0) ratingBuckets["2.0-2.9"]++;
      else ratingBuckets["1.0-1.9"]++;
    });
    
    return Object.entries(ratingBuckets)
      .map(([range, count]) => ({ range, count }))
      .reverse(); // Show 5.0 at top
  }, [activeWines]);

  // Stats
  const stats = useMemo(() => {
    const ratedWines = activeWines.filter(w => w.score !== null && w.score !== undefined);
    
    if (ratedWines.length === 0) {
      return {
        avgRating: 0,
        topRated: null,
        mostCommonRange: null,
        ratedCount: 0,
      };
    }
    
    const avgRating = ratedWines.reduce((sum, w) => sum + (w.score || 0), 0) / ratedWines.length;
    const topRated = [...ratedWines].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    
    // Find most common rating range
    const maxCount = Math.max(...ratingData.map(d => d.count));
    const mostCommonRange = ratingData.find(d => d.count === maxCount && d.count > 0);
    
    return {
      avgRating,
      topRated,
      mostCommonRange: mostCommonRange?.range,
      ratedCount: ratedWines.length,
    };
  }, [activeWines, ratingData]);

  // Get color based on rating range
  const getBarColor = (range: string) => {
    if (range.startsWith("5") || range.startsWith("4.5")) return "hsl(142, 70%, 45%)"; // green
    if (range.startsWith("4")) return "hsl(45, 80%, 50%)"; // gold
    if (range.startsWith("3.5")) return "hsl(45, 60%, 55%)"; // yellow
    if (range.startsWith("3")) return "hsl(30, 70%, 50%)"; // orange
    return "hsl(0, 60%, 50%)"; // red
  };

  // Custom tooltip component to show breakdown
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    
    const data = payload[0].payload;
    const range = data.range;
    const breakdown = getRatingBreakdown(range);
    
    if (breakdown.length === 0) return null;
    
    return (
      <div className="bg-background border border-border/50 rounded-xl p-3 shadow-lg">
        <p className="text-sm font-semibold mb-2">{range}</p>
        <div className="space-y-1">
          {breakdown.map((item) => (
            <div key={item.rating} className="flex items-center justify-between text-xs gap-3">
              <span className="text-muted-foreground">{item.rating.toFixed(1)}</span>
              <span className="font-medium text-foreground">—</span>
              <span className="font-semibold text-primary">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Your Rating Distribution
          </DialogTitle>
        </DialogHeader>

        {/* Insights */}
        {stats.topRated && (
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {stats.topRated.label_image_url ? (
                <div className="relative w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <Image
                    src={stats.topRated.label_image_url}
                    alt={stats.topRated.name}
                    fill
                    className="object-cover"
                    unoptimized={stats.topRated.label_image_url?.includes('costcowineblog.com')}
                  />
                </div>
              ) : (
                <div className="w-16 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <WineIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {stats.topRated.name}
                  {stats.topRated.vintage && ` (${stats.topRated.vintage})`}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="font-medium text-foreground">{stats.topRated.score?.toFixed(1)}</span>
                  <span className="text-xs">Your #1 Top-rated wine</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-muted/20 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <p className="text-2xl font-bold">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}</p>
            </div>
            <p className="text-xs text-muted-foreground">Average Rating</p>
          </div>
          <div className="bg-muted/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.ratedCount}</p>
            <p className="text-xs text-muted-foreground">Rated Wines</p>
          </div>
          <div className="bg-muted/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{activeWines.length - stats.ratedCount}</p>
            <p className="text-xs text-muted-foreground">Unrated</p>
          </div>
        </div>

{/* Top Rated Wines */}
{stats.ratedCount > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-500" />
              Your Top Rated Wines
            </h3>
            <div className="space-y-1.5">
              {activeWines
                .filter(w => w.score !== null && w.score !== undefined)
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 5)
                .map((wine, index) => (
                  <div 
                    key={wine.id}
                    className="flex items-center justify-between py-1.5 px-3 bg-muted/20 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2 truncate flex-1 mr-2">
                      <span className="text-muted-foreground text-xs">#{index + 1}</span>
                      <span className="truncate">
                        {wine.name}
                        {wine.vintage && <span className="text-muted-foreground"> ({wine.vintage})</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium">{wine.score?.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Rating Distribution Chart */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Rating Distribution
          </h3>
          <div className="h-[220px] w-full">
            {stats.ratedCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={ratingData} 
                  layout="vertical"
                  margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="range" 
                    width={60}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="count" 
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                    >
                      {ratingData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getBarColor(entry.range)} 
                        />
                      ))}
                    </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No rated wines yet
              </div>
            )}
          </div>
          
        </div>
      </DialogContent>
    </Dialog>
  );
}

