"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatBoxProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  onClick?: () => void;
  iconClassName?: string;
}

export function StatBox({ icon, value, label, onClick, iconClassName }: StatBoxProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-muted/30 rounded-xl p-4 text-center w-full transition-all duration-200",
        onClick && "hover:bg-muted/50 hover:shadow-md hover:scale-[1.02] cursor-pointer active:scale-[0.98]"
      )}
    >
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className={cn("w-4 h-4", iconClassName)}>{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

