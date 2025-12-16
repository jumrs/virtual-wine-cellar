"use client";

import { ReactNode } from "react";
import { Wine } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icon to display (defaults to Wine icon) */
  icon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Action button or content */
  action?: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Reusable empty state component for when there's no data to display
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      <div className="empty-state-icon">
        {icon || <Wine className="w-full h-full" />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-text">{description}</p>}
      {action}
    </div>
  );
}

/**
 * Compact empty state for inline use
 */
export function EmptyStateCompact({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center py-8 text-muted-foreground", className)}>
      <p className="text-sm">{message}</p>
    </div>
  );
}

