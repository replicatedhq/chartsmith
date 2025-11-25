"use client";

import { memo } from "react";
import { Square, Clock, Flame } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";

interface ChatLoadingStateProps {
  theme: string;
  isLongRunning: boolean;
  onStop: () => void;
}

/**
 * Loading state component shown during AI response generation.
 * Memoized to prevent unnecessary re-renders.
 * Styled with the forge design system.
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
      className={`mx-2 my-3 p-4 rounded-forge-lg border ${
        theme === 'dark'
          ? 'bg-forge-steel/50 border-forge-iron'
          : 'bg-stone-50 border-stone-200'
      }`}
      role="status"
      aria-live="polite"
      aria-label={isLongRunning ? "ChartSmith is forging, taking longer than expected" : "ChartSmith is forging"}
    >
      <div className="flex items-center gap-4">
        <div
          className={`p-2.5 rounded-full ${
            theme === 'dark' ? 'bg-forge-ember/20' : 'bg-forge-ember/10'
          }`}
          aria-hidden="true"
        >
          <Flame className="w-5 h-5 text-forge-ember animate-pulse" />
        </div>
        <div className="flex-1">
          <span className={`text-sm font-display font-semibold ${
            theme === 'dark' ? 'text-stone-100' : 'text-stone-800'
          }`}>
            Forging your response...
          </span>
          {isLongRunning && (
            <div
              className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${
                theme === 'dark' ? 'text-forge-warning' : 'text-amber-600'
              }`}
              role="alert"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Heating up... this is taking a bit longer</span>
            </div>
          )}
        </div>
        <button
          onClick={onStop}
          aria-label="Stop generating response"
          className={`px-3 py-2 text-xs font-medium rounded-forge transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forge-error/50 ${
            theme === 'dark'
              ? 'bg-forge-error/20 text-forge-error border border-forge-error/30 hover:bg-forge-error/30 hover:border-forge-error/50'
              : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300'
          }`}
          title="Stop forging"
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
