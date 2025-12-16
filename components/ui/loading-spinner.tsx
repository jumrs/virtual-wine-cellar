"use client";

import { Wine } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional message to display */
  message?: string;
  /** Whether to show full screen centered */
  fullScreen?: boolean;
  /** Additional className */
  className?: string;
}

const sizeClasses = {
  sm: { container: "w-8 h-8", icon: "h-4 w-4" },
  md: { container: "w-12 h-12", icon: "h-6 w-6" },
  lg: { container: "w-16 h-16", icon: "h-8 w-8" },
};

/**
 * Reusable loading spinner component with wine icon
 */
export function LoadingSpinner({
  size = "md",
  message,
  fullScreen = false,
  className,
}: LoadingSpinnerProps) {
  const sizes = sizeClasses[size];

  const content = (
    <div className={cn("text-center", className)}>
      <div
        className={cn(
          "mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse",
          sizes.container
        )}
      >
        <Wine className={cn("text-primary", sizes.icon)} />
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * Inline loading indicator for buttons or small areas
 */
export function InlineLoader({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={cn("animate-spin text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

