"use client";

import { memo } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";

interface ErrorInfo {
  title: string;
  description: string;
  canRetry: boolean;
}

/**
 * Get user-friendly error message based on error type.
 * Uses forge-themed messaging.
 */
export function getErrorMessage(error: Error): ErrorInfo {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return {
      title: 'Forge cooling down',
      description: 'Too many requests. The forge needs a moment to cool before the next strike.',
      canRetry: true,
    };
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return {
      title: 'Connection lost',
      description: 'Unable to reach the forge. Please check your connection.',
      canRetry: true,
    };
  }

  if (message.includes('timeout') || message.includes('504')) {
    return {
      title: 'Request timed out',
      description: 'The forging process took too long. Please try again.',
      canRetry: true,
    };
  }

  if (message.includes('401') || message.includes('unauthorized')) {
    return {
      title: 'Session expired',
      description: 'Your forge access has expired. Please refresh the page to continue.',
      canRetry: false,
    };
  }

  if (message.includes('500') || message.includes('server error')) {
    return {
      title: 'Forge malfunction',
      description: 'Something went wrong in the forge. Our smiths are on it.',
      canRetry: true,
    };
  }

  return {
    title: 'Forging failed',
    description: error.message || 'An unexpected error occurred.',
    canRetry: true,
  };
}

interface ChatErrorStateProps {
  error: Error;
  theme: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

/**
 * Error state component with retry functionality.
 * Memoized to prevent unnecessary re-renders.
 * Styled with the forge design system.
 *
 * Accessibility:
 * - role="alert" for immediate announcement
 * - aria-live="assertive" for urgent errors
 * - Proper heading hierarchy
 * - Focus management for interactive elements
 */
export const ChatErrorState = memo(function ChatErrorState({
  error,
  theme,
  onRetry,
  onDismiss
}: ChatErrorStateProps) {
  const { title, description, canRetry } = getErrorMessage(error);

  return (
    <div
      className={`mx-2 my-3 p-4 rounded-forge-lg border ${
        theme === 'dark'
          ? 'bg-forge-error/10 border-forge-error/30'
          : 'bg-red-50 border-red-200'
      }`}
      role="alert"
      aria-live="assertive"
      aria-describedby="error-description"
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-2.5 rounded-full flex-shrink-0 ${
            theme === 'dark' ? 'bg-forge-error/20' : 'bg-red-100'
          }`}
          aria-hidden="true"
        >
          <AlertCircle className={`w-5 h-5 ${
            theme === 'dark' ? 'text-forge-error' : 'text-red-600'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-display font-semibold ${
            theme === 'dark' ? 'text-forge-error' : 'text-red-800'
          }`}>
            {title}
          </h4>
          <p
            id="error-description"
            className={`mt-1 text-sm ${
              theme === 'dark' ? 'text-stone-400' : 'text-red-600/80'
            }`}
          >
            {description}
          </p>
          <div className="flex items-center gap-2 mt-4" role="group" aria-label="Error actions">
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                aria-label="Try again"
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-forge transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forge-ember/50 ${
                  theme === 'dark'
                    ? 'bg-forge-ember text-white hover:bg-forge-ember-bright'
                    : 'bg-forge-ember text-white hover:bg-forge-ember-bright'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Reheat & retry
              </button>
            )}
            <button
              onClick={onDismiss}
              aria-label="Dismiss error"
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-forge transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forge-zinc/50 ${
                theme === 'dark'
                  ? 'text-forge-silver hover:text-stone-100 hover:bg-forge-iron/50'
                  : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100'
              }`}
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
