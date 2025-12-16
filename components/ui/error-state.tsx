"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message */
  message?: string;
  /** Retry function */
  onRetry?: () => void;
  /** Whether retry is loading */
  retrying?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Reusable error state component
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred. Please try again.",
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
          className="rounded-full"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", retrying && "animate-spin")} />
          {retrying ? "Retrying..." : "Try Again"}
        </Button>
      )}
    </div>
  );
}

/**
 * Compact inline error message
 */
export function ErrorMessage({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-destructive flex items-center gap-1", className)}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </p>
  );
}

