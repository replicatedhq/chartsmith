'use client';

import React, { useRef, useEffect } from 'react';
import { Send, Loader2, StopCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAIChat, ChatMessage } from '@/hooks/useAIChat';
import { AIMessageParts, AIMessageLoading, AIMessageError } from './AIMessageParts';

/**
 * AI Chat Demo Component
 *
 * This component demonstrates the Vercel AI SDK integration for Chartsmith.
 * It uses the new useChat hook pattern and renders messages with parts.
 *
 * This is a standalone demo component that can be used to test the AI SDK
 * integration independently from the existing chat system.
 *
 * Usage:
 * ```tsx
 * <AIChatDemo workspaceId="workspace-123" />
 * ```
 */

interface AIChatDemoProps {
  /** Optional workspace ID for context */
  workspaceId?: string;
  /** Optional initial context (e.g., chart structure) */
  context?: string;
}

export function AIChatDemo({ workspaceId, context }: AIChatDemoProps) {
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    status,
    error,
    stop,
  } = useAIChat({
    workspaceId,
    context,
    onFinish: (message) => {
      console.log('[Demo] Message finished:', message.id);
    },
    onError: (error) => {
      console.error('[Demo] Chat error:', error);
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';

    return (
      <div
        key={message.id}
        className="px-2 py-1"
        data-testid={isUser ? 'user-message' : 'assistant-message'}
      >
        <div
          className={`p-3 rounded-lg ${
            isUser
              ? theme === 'dark'
                ? 'bg-primary/20 rounded-tr-sm'
                : 'bg-primary/10 rounded-tr-sm'
              : theme === 'dark'
              ? 'bg-dark-border/40 rounded-tl-sm'
              : 'bg-gray-100 rounded-tl-sm'
          } w-full`}
        >
          {/* Header */}
          <div
            className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            } mb-1`}
          >
            {isUser ? 'You' : 'ChartSmith AI'}
          </div>

          {/* Content */}
          {isUser ? (
            <div
              className={`text-[12px] ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}
            >
              {message.content}
            </div>
          ) : (
            <AIMessageParts content={message.content} role={message.role} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`h-full flex flex-col border rounded-lg overflow-hidden ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <div
        className={`p-3 border-b ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-900'
              }`}
            >
              AI SDK Chat Demo
            </h3>
            <p
              className={`text-xs ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Powered by Vercel AI SDK + Anthropic
            </p>
          </div>
          <div
            className={`text-[10px] px-2 py-1 rounded ${
              status === 'streaming'
                ? 'bg-green-500/10 text-green-500'
                : status === 'submitted'
                ? 'bg-yellow-500/10 text-yellow-500'
                : status === 'error'
                ? 'bg-red-500/10 text-red-500'
                : theme === 'dark'
                ? 'bg-dark-border/40 text-gray-400'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {status}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div
            className={`text-center py-8 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            <p className="text-sm">Start a conversation about Helm charts</p>
            <p className="text-xs mt-1">
              Try asking about best practices, templates, or values configuration
            </p>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}

            {/* Loading indicator */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="px-2 py-1">
                <div
                  className={`p-3 rounded-lg rounded-tl-sm ${
                    theme === 'dark' ? 'bg-dark-border/40' : 'bg-gray-100'
                  }`}
                >
                  <AIMessageLoading />
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="px-2 py-1">
                <AIMessageError error={error} />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className={`p-3 border-t ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Helm charts..."
            rows={1}
            disabled={isLoading}
            style={{ height: 'auto', minHeight: '38px', maxHeight: '150px' }}
            className={`w-full px-3 py-2 pr-20 text-sm rounded-md border resize-none ${
              theme === 'dark'
                ? 'bg-dark border-dark-border/60 text-white placeholder-gray-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-50`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                className={`p-1.5 rounded-full ${
                  theme === 'dark'
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                    : 'text-red-500 hover:text-red-600 hover:bg-red-50'
                }`}
                title="Stop generating"
              >
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={`p-1.5 rounded-full ${
                  !input.trim()
                    ? theme === 'dark'
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-300 cursor-not-allowed'
                    : theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-dark-border/40'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
