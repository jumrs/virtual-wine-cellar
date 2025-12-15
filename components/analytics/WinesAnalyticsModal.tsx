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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Grape, Wine as WineIcon } from "lucide-react";

interface WinesAnalyticsModalProps {
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
];

const TYPE_COLORS: Record<string, string> = {
  "Red": "hsl(348, 83%, 47%)",
  "White": "hsl(45, 80%, 60%)",
  "Rosé": "hsl(340, 70%, 70%)",
  "Sparkling": "hsl(45, 70%, 75%)",
  "Dessert": "hsl(30, 70%, 50%)",
  "Other": "hsl(200, 20%, 60%)",
};

export function WinesAnalyticsModal({ open, onOpenChange, wines }: WinesAnalyticsModalProps) {
  // Calculate grape variety data
  const grapeData = useMemo(() => {
    const grapeCount: Record<string, number> = {};
    wines.forEach((wine) => {
      const grape = wine.grape || "Unknown";
      grapeCount[grape] = (grapeCount[grape] || 0) + 1;
    });
    
    return Object.entries(grapeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 grapes
  }, [wines]);

  // Calculate wine type distribution
  const typeData = useMemo(() => {
    const typeCount: Record<string, number> = {};
    wines.forEach((wine) => {
      let type = wine.type || "Other";
      // Normalize type names
      if (type.toLowerCase().includes("red")) type = "Red";
      else if (type.toLowerCase().includes("white")) type = "White";
      else if (type.toLowerCase().includes("rosé") || type.toLowerCase().includes("rose")) type = "Rosé";
      else if (type.toLowerCase().includes("sparkling") || type.toLowerCase().includes("champagne")) type = "Sparkling";
      else if (type.toLowerCase().includes("dessert") || type.toLowerCase().includes("sweet")) type = "Dessert";
      else type = "Other";
      
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    return Object.entries(typeCount)
      .map(([name, value]) => ({ name, value, fill: TYPE_COLORS[name] || TYPE_COLORS["Other"] }))
      .sort((a, b) => b.value - a.value);
  }, [wines]);

  const totalGrapeVarieties = useMemo(() => {
    const grapes = new Set(wines.map(w => w.grape).filter(Boolean));
    return grapes.size;
  }, [wines]);

  const mostCommonGrape = grapeData[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WineIcon className="w-5 h-5 text-primary" />
            Your Wine Variety Breakdown
          </DialogTitle>
          <DialogDescription>
            Explore the diversity of your wine collection
          </DialogDescription>
        </DialogHeader>

        {/* Insights */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-1">
          <p className="text-sm">
            <span className="font-medium">You have wines from {totalGrapeVarieties} grape varieties.</span>
          </p>
          {mostCommonGrape && (
            <p className="text-sm text-muted-foreground">
              Most common: <span className="font-medium text-foreground">{mostCommonGrape.name}</span> ({mostCommonGrape.value} wines)
            </p>
          )}
        </div>

        {/* Charts Container */}
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Grape Variety Pie Chart */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Grape className="w-4 h-4 text-primary" />
              By Grape Variety
            </h3>
            <div className="h-[220px] w-full">
              {grapeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={grapeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => 
                        percent > 0.05 ? `${name.slice(0, 10)}${name.length > 10 ? '...' : ''}` : ''
                      }
                      labelLine={false}
                    >
                      {grapeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value} wines`, 'Count']}
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
                  No grape data available
                </div>
              )}
            </div>
          </div>

          {/* Wine Type Bar Chart */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <WineIcon className="w-4 h-4 text-primary" />
              By Wine Type
            </h3>
            <div className="h-[220px] w-full">
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={70}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
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
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No type data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Grape Legend */}
        {grapeData.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {grapeData.map((grape, index) => (
              <div key={grape.name} className="flex items-center gap-1.5 text-xs">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-muted-foreground">{grape.name}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

