"use client";

import { memo } from "react";

interface TypingIndicatorProps {
  theme: string;
}

/**
 * Animated typing indicator with three bouncing dots.
 * Memoized to prevent unnecessary re-renders during streaming.
 */
export const TypingIndicator = memo(function TypingIndicator({ theme }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5" role="status" aria-label="ChartSmith is typing">
      <span
        className={`w-2 h-2 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`}
        style={{ animationDelay: '0ms', animationDuration: '600ms' }}
      />
      <span
        className={`w-2 h-2 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`}
        style={{ animationDelay: '150ms', animationDuration: '600ms' }}
      />
      <span
        className={`w-2 h-2 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`}
        style={{ animationDelay: '300ms', animationDuration: '600ms' }}
      />
    </div>
  );
});
