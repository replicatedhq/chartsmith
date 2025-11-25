"use client";

import { memo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorInfo {
  title: string;
  description: string;
  canRetry: boolean;
}

/**
 * Get user-friendly error message based on error type.
 */
export function getErrorMessage(error: Error): ErrorInfo {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return {
      title: 'Rate limit exceeded',
      description: 'Too many requests. Please wait a moment before trying again.',
      canRetry: true,
    };
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return {
      title: 'Connection error',
      description: 'Unable to connect to the server. Please check your internet connection.',
      canRetry: true,
    };
  }

  if (message.includes('timeout') || message.includes('504')) {
    return {
      title: 'Request timeout',
      description: 'The request took too long to complete. Please try again.',
      canRetry: true,
    };
  }

  if (message.includes('401') || message.includes('unauthorized')) {
    return {
      title: 'Authentication error',
      description: 'Your session may have expired. Please refresh the page.',
      canRetry: false,
    };
  }

  if (message.includes('500') || message.includes('server error')) {
    return {
      title: 'Server error',
      description: 'Something went wrong on our end. Please try again later.',
      canRetry: true,
    };
  }

  return {
    title: 'Something went wrong',
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
      className={`mx-2 my-2 p-4 rounded-lg border ${
        theme === 'dark'
          ? 'bg-red-950/30 border-red-900/50'
          : 'bg-red-50 border-red-200'
      }`}
      role="alert"
      aria-live="assertive"
      aria-describedby="error-description"
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-full flex-shrink-0 ${
            theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
          }`}
          aria-hidden="true"
        >
          <AlertCircle className={`w-4 h-4 ${
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${
            theme === 'dark' ? 'text-red-300' : 'text-red-800'
          }`}>
            {title}
          </h4>
          <p
            id="error-description"
            className={`mt-1 text-xs ${
              theme === 'dark' ? 'text-red-400/80' : 'text-red-600'
            }`}
          >
            {description}
          </p>
          <div className="flex items-center gap-2 mt-3" role="group" aria-label="Error actions">
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                aria-label="Try again"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                  theme === 'dark'
                    ? 'bg-red-900/50 text-red-300 hover:bg-red-900/70 hover:text-red-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800'
                }`}
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                Try again
              </button>
            )}
            <button
              onClick={onDismiss}
              aria-label="Dismiss error"
              className={`px-3 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/50 ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-dark-border/40'
                  : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
