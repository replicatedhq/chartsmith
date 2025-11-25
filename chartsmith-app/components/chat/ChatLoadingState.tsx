"use client";

import { memo } from "react";
import { Square, Clock } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";

interface ChatLoadingStateProps {
  theme: string;
  isLongRunning: boolean;
  onStop: () => void;
}

/**
 * Loading state component shown during AI response generation.
 * Memoized to prevent unnecessary re-renders.
 *
 * Accessibility:
 * - role="status" announces to screen readers
 * - aria-live="polite" for non-intrusive announcements
 * - Clear visual and text indicators
 */
export const ChatLoadingState = memo(function ChatLoadingState({
  theme,
  isLongRunning,
  onStop
}: ChatLoadingStateProps) {
  return (
    <div
      className={`mx-2 my-2 p-3 rounded-lg ${
        theme === 'dark' ? 'bg-dark-border/30' : 'bg-gray-50'
      }`}
      role="status"
      aria-live="polite"
      aria-label={isLongRunning ? "ChartSmith is thinking, taking longer than expected" : "ChartSmith is thinking"}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-full ${
            theme === 'dark' ? 'bg-primary/20' : 'bg-primary/10'
          }`}
          aria-hidden="true"
        >
          <TypingIndicator theme={theme} />
        </div>
        <div className="flex-1">
          <span className={`text-sm font-medium ${
            theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
          }`}>
            ChartSmith is thinking...
          </span>
          {isLongRunning && (
            <div
              className={`flex items-center gap-1.5 mt-1 text-xs ${
                theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
              }`}
              role="alert"
            >
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>This is taking longer than expected...</span>
            </div>
          )}
        </div>
        <button
          onClick={onStop}
          aria-label="Stop generating response"
          className={`px-3 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
            theme === 'dark'
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300'
              : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
          }`}
          title="Stop generating"
        >
          <span className="flex items-center gap-1.5">
            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
            Stop
          </span>
        </button>
      </div>
    </div>
  );
});
