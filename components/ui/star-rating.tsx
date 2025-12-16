"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StarRatingDisplayProps {
  /** Score to display (0-5) */
  score: number;
  /** Size of stars */
  size?: "sm" | "md" | "lg";
  /** Whether to show the numeric value */
  showValue?: boolean;
  /** Additional className */
  className?: string;
}

const starSizes = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-6 h-6",
};

/**
 * Read-only star rating display with partial star support
 */
export const StarRatingDisplay = memo(function StarRatingDisplay({
  score,
  size = "sm",
  showValue = false,
  className,
}: StarRatingDisplayProps) {
  const fullStars = Math.floor(score);
  const partialFill = score - fullStars;
  const emptyStars = 5 - fullStars - (partialFill > 0 ? 1 : 0);
  const sizeClass = starSizes[size];

  return (
    <div className={cn("star-rating", className)}>
      {/* Full stars */}
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className={cn(sizeClass, "star-filled")} />
      ))}

      {/* Partial star */}
      {partialFill > 0 && (
        <div className={cn("relative flex-shrink-0", sizeClass)}>
          <Star className={cn(sizeClass, "star-empty absolute inset-0")} />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${partialFill * 100}%` }}
          >
            <Star className={cn(sizeClass, "star-filled")} />
          </div>
        </div>
      )}

      {/* Empty stars */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className={cn(sizeClass, "star-empty")} />
      ))}

      {showValue && (
        <span className="text-xs font-medium ml-1">{score.toFixed(1)}</span>
      )}
    </div>
  );
});

interface StarRatingInputProps {
  /** Current value (0-5) */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Interactive star rating input with decimal support
 */
export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  className,
}: StarRatingInputProps) {
  const [inputValue, setInputValue] = useState(value > 0 ? value.toFixed(1) : "");
  const [isFocused, setIsFocused] = useState(false);

  // Update input when value prop changes (if not focused)
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value > 0 ? value.toFixed(1) : "");
    }
  }, [value, isFocused]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      const numValue = parseFloat(newValue);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 5) {
        onChange(numValue);
      } else if (newValue === "" || newValue === ".") {
        onChange(0);
      }
    },
    [onChange]
  );

  const handleInputBlur = useCallback(() => {
    setIsFocused(false);
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || numValue < 0) {
      setInputValue("0.0");
      onChange(0);
    } else if (numValue > 5) {
      setInputValue("5.0");
      onChange(5);
    } else {
      setInputValue(numValue.toFixed(1));
      onChange(numValue);
    }
  }, [inputValue, onChange]);

  const handleStarClick = useCallback(
    (starValue: number) => {
      if (disabled) return;
      onChange(value === starValue ? 0 : starValue);
    },
    [value, onChange, disabled]
  );

  const fullStars = Math.floor(value);
  const partialFill = value - fullStars;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Visual Stars */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = star <= fullStars;
          const isPartial = star === fullStars + 1 && partialFill > 0;

          return (
            <button
              key={star}
              type="button"
              onClick={() => handleStarClick(star)}
              disabled={disabled}
              className="p-1 hover:scale-110 transition-transform relative disabled:cursor-not-allowed"
            >
              {isFull ? (
                <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              ) : isPartial ? (
                <div className="relative w-6 h-6 flex-shrink-0">
                  <Star className="w-6 h-6 text-gray-300 absolute inset-0" />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${partialFill * 100}%` }}
                  >
                    <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  </div>
                </div>
              ) : (
                <Star className="w-6 h-6 text-gray-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* Decimal Input */}
      <div className="flex items-center gap-3">
        <Label htmlFor="rating-input" className="text-sm font-medium">
          Rating:
        </Label>
        <Input
          id="rating-input"
          type="number"
          step="0.1"
          min="0"
          max="5"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleInputBlur}
          placeholder="0.0"
          disabled={disabled}
          className="w-24 h-10 elegant-input text-center"
        />
        <span className="text-sm text-muted-foreground">/ 5.0</span>
      </div>
    </div>
  );
}

