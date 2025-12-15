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
} from "recharts";
import { Package, TrendingUp } from "lucide-react";

interface BottlesAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wines: Wine[];
}

export function BottlesAnalyticsModal({ open, onOpenChange, wines }: BottlesAnalyticsModalProps) {
  // Calculate bottles per wine (top 10)
  const bottleData = useMemo(() => {
    return wines
      .filter(w => (w.quantity || 0) > 0)
      .map(wine => ({
        name: wine.name.length > 20 ? wine.name.slice(0, 20) + '...' : wine.name,
        fullName: wine.name,
        bottles: wine.quantity || 0,
        vintage: wine.vintage,
      }))
      .sort((a, b) => b.bottles - a.bottles)
      .slice(0, 10);
  }, [wines]);

  // Stats
  const stats = useMemo(() => {
    const winesWithMultipleBottles = wines.filter(w => (w.quantity || 0) > 1).length;
    const mostStocked = bottleData[0];
    const totalBottles = wines.reduce((sum, w) => sum + (w.quantity || 0), 0);
    const avgBottlesPerWine = wines.length > 0 ? (totalBottles / wines.length).toFixed(1) : 0;
    
    return {
      winesWithMultipleBottles,
      mostStocked,
      totalBottles,
      avgBottlesPerWine,
    };
  }, [wines, bottleData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Bottle Count Insights
          </DialogTitle>
        </DialogHeader>

        {/* Insights */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-1">
          <p className="text-sm">
            <span className="font-medium">You have {stats.winesWithMultipleBottles} wines with multiple bottles.</span>
          </p>
          {stats.mostStocked && (
            <p className="text-sm text-muted-foreground">
              Your most stocked wine is{" "}
              <span className="font-medium text-foreground">
                {stats.mostStocked.fullName}
                {stats.mostStocked.vintage && ` ${stats.mostStocked.vintage}`}
              </span>{" "}
              ({stats.mostStocked.bottles} bottles)
            </p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-muted/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.totalBottles}</p>
            <p className="text-xs text-muted-foreground">Total Bottles</p>
          </div>
          <div className="bg-muted/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.avgBottlesPerWine}</p>
            <p className="text-xs text-muted-foreground">Avg per Wine</p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Top 10 Most Stocked Wines
          </h3>
          <div className="h-[280px] w-full">
            {bottleData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={bottleData} 
                  layout="vertical" 
                  margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={130}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number, _, props) => [
                      `${value} bottles`,
                      props.payload.fullName + (props.payload.vintage ? ` (${props.payload.vintage})` : '')
                    ]}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="bottles" 
                    fill="hsl(348, 83%, 47%)"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No bottle data available
              </div>
            )}
          </div>
        </div>

        {/* Wine List */}
        {bottleData.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium">Quick Overview</h3>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {bottleData.slice(0, 5).map((wine, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between py-1.5 px-3 bg-muted/20 rounded-lg text-sm"
                >
                  <span className="truncate flex-1 mr-2">
                    {wine.fullName}
                    {wine.vintage && <span className="text-muted-foreground"> ({wine.vintage})</span>}
                  </span>
                  <span className="font-medium text-primary whitespace-nowrap">
                    {wine.bottles} bottles
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

