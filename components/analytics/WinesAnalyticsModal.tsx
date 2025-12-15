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
  // Calculate grape variety data (top 5)
  const grapeData = useMemo(() => {
    const grapeCount: Record<string, number> = {};
    wines.forEach((wine) => {
      const grape = wine.grape || "Unknown";
      grapeCount[grape] = (grapeCount[grape] || 0) + 1;
    });
    
    return Object.entries(grapeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 grapes
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

        {/* Grape Variety Bar Chart */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Grape className="w-4 h-4 text-primary" />
            Top 5 Grape Varieties
          </h3>
          <div className="h-[200px] w-full">
            {grapeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={grapeData} 
                  layout="vertical"
                  margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={120}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number | undefined) => [`${value || 0} wines`, 'Count']}
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
                  >
                    {grapeData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No grape data available
              </div>
            )}
          </div>
        </div>

        {/* Wine Type List */}
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <WineIcon className="w-4 h-4 text-primary" />
            Wine Types
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {typeData.map((type) => (
              <div 
                key={type.name}
                className="flex items-center justify-between py-1.5 px-3 bg-muted/20 rounded-lg text-sm"
              >
                <span className="truncate">{type.name}</span>
                <span className="font-medium text-primary ml-2">{type.value}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

