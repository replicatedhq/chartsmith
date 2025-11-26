"use client";

import { memo } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md';
}

export const LoadingSpinner = memo(function LoadingSpinner({
  message,
  size = 'sm'
}: LoadingSpinnerProps) {
  const { theme } = useTheme();
  const sizeClasses = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <div
        className={`flex-shrink-0 animate-spin rounded-full border-2 border-forge-iron border-t-forge-ember ${sizeClasses}`}
        aria-hidden="true"
      />
      {message && (
        <div className={`text-xs ${theme === "dark" ? "text-forge-zinc" : "text-stone-500"}`}>
          {message}
        </div>
      )}
    </div>
  );
});
