"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { Send, Loader2, Square, RefreshCw, Sparkles } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ProviderSelector } from "./ProviderSelector";
import { AIMessageList } from "./AIMessageList";
import { ScrollingContent } from "@/components/ScrollingContent";
import { 
  type Provider, 
  getDefaultProvider, 
  getDefaultModelForProvider,
  STREAMING_THROTTLE_MS,
} from "@/lib/ai";

export interface AIChatProps {
  /** Optional initial messages */
  initialMessages?: UIMessage[];
  /** Optional initial prompt to send automatically on mount */
  initialPrompt?: string;
  /** Optional callback when conversation starts */
  onConversationStart?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * AIChat Component
 * 
 * A NEW chat interface using Vercel AI SDK's useChat hook.
 * Styled to match the existing ChatContainer for seamless integration.
 * 
 * Features:
 * - Multi-provider support (OpenAI, Anthropic) via direct APIs or OpenRouter
 * - Provider selection (replaces role selector position)
 * - Real-time streaming responses
 * - Stop/regenerate controls
 * - Error handling with retry option
 */
export function AIChat({
  initialMessages = [],
  initialPrompt,
  onConversationStart,
  className = "",
}: AIChatProps) {
  const { theme } = useTheme();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const hasAutoSentInitialPrompt = useRef(false);

  // Provider state - locked after first message
  const [selectedProvider, setSelectedProvider] = useState<Provider>(getDefaultProvider);
  const [selectedModel, setSelectedModel] = useState<string>(() => 
    getDefaultModelForProvider(getDefaultProvider())
  );
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);

  // Input state (managed separately in AI SDK v5)
  const [input, setInput] = useState("");

  // Create transport with dynamic body containing provider/model
  const transport = React.useMemo(() => {
    return new TextStreamChatTransport({
      api: "/api/chat",
      body: {
        provider: selectedProvider,
        model: selectedModel,
      },
    });
  }, [selectedProvider, selectedModel]);

  // useChat hook from AI SDK v5
  const {
    messages,
    sendMessage,
    regenerate,
    status,
    error,
    stop,
    setMessages,
    clearError,
  } = useChat({
    transport,
    messages: initialMessages,
    experimental_throttle: STREAMING_THROTTLE_MS,
    onFinish: () => {
      inputRef.current?.focus();
    },
    onError: (err: Error) => {
      console.error("Chat error:", err);
    },
  });

  // Determine loading state from status
  const isLoading = status === "submitted" || status === "streaming";

  // Determine if provider can be changed (only when no messages)
  const canChangeProvider = messages.length === 0;

  // Close provider menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setIsProviderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-send initial prompt if provided
  useEffect(() => {
    if (initialPrompt && !hasAutoSentInitialPrompt.current && status === "ready") {
      hasAutoSentInitialPrompt.current = true;
      if (onConversationStart) {
        onConversationStart();
      }
      sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, status, sendMessage, onConversationStart]);

  // Handle provider change
  const handleProviderChange = (provider: Provider, model: string) => {
    if (!canChangeProvider) return;
    setSelectedProvider(provider);
    setSelectedModel(model);
    setIsProviderMenuOpen(false);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (messages.length === 0 && onConversationStart) {
      onConversationStart();
    }

    const messageText = input.trim();
    setInput("");
    
    await sendMessage({ text: messageText });
  };

  // Handle key press (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleFormSubmit(e);
      }
    }
  };

  // Handle regenerate
  const handleRegenerate = async () => {
    if (error) {
      clearError();
    }
    await regenerate();
  };

  // Get provider display name
  const getProviderLabel = () => {
    return selectedProvider === 'anthropic' ? 'Claude' : 'GPT-4o';
  };

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${
      theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
    } ${className}`}>
      
      {/* Messages Area */}
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className="pb-32">
            {messages.length === 0 ? (
              // Empty state - matches main app style
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                  theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"
                }`}>
                  <Send className={`w-6 h-6 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`} />
                </div>
                <h3 className={`text-lg font-medium mb-2 ${
                  theme === "dark" ? "text-gray-200" : "text-gray-700"
                }`}>
                  Start a conversation
                </h3>
                <p className={`text-sm max-w-sm ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}>
                  Ask questions about Helm charts, Kubernetes configurations, or get help creating and modifying your charts.
                </p>
              </div>
            ) : (
              <AIMessageList messages={messages} />
            )}
          </div>
        </ScrollingContent>
      </div>

      {/* Error Display */}
      {error && (
        <div className={`mx-2 mb-2 p-3 rounded-lg ${
          theme === "dark"
            ? "bg-red-900/20 border border-red-800/50"
            : "bg-red-50 border border-red-200"
        }`}>
          <div className={`text-xs ${theme === "dark" ? "text-red-300" : "text-red-700"}`}>
            {error.message || "An error occurred"}
            <button
              onClick={handleRegenerate}
              className="ml-2 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Input Area - Matches ChatContainer exactly */}
      <div className={`absolute bottom-0 left-0 right-0 ${
        theme === "dark" ? "bg-dark-surface" : "bg-white"
      } border-t ${
        theme === "dark" ? "border-dark-border" : "border-gray-200"
      }`}>
        <form onSubmit={handleFormSubmit} className="p-3 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-24 text-sm rounded-md border resize-none overflow-hidden ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
            disabled={isLoading}
          />
          
          <div className="absolute right-4 top-[18px] flex gap-2">
            {/* Provider selector (replaces role selector) */}
            <div ref={providerMenuRef} className="relative">
              <button
                type="button"
                onClick={() => canChangeProvider && setIsProviderMenuOpen(!isProviderMenuOpen)}
                disabled={!canChangeProvider}
                className={`p-1.5 rounded-full ${
                  theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                } ${!canChangeProvider ? "opacity-50 cursor-not-allowed" : ""}`}
                title={`Model: ${getProviderLabel()}${!canChangeProvider ? " (locked)" : ""}`}
              >
                <Sparkles className="w-4 h-4" />
              </button>
              
              {/* Provider dropdown - matches role selector style */}
              {isProviderMenuOpen && canChangeProvider && (
                <div className={`absolute bottom-full right-0 mb-1 w-56 rounded-lg shadow-lg border py-1 z-50 ${
                  theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
                }`}>
                  <div className={`px-3 py-2 text-xs font-medium ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Select AI Model
                  </div>
                  {[
                    { id: 'anthropic' as Provider, name: 'Claude Sonnet 4', model: 'anthropic/claude-sonnet-4-20250514' },
                    { id: 'openai' as Provider, name: 'GPT-4o', model: 'openai/gpt-4o' },
                  ].map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => handleProviderChange(provider.id, provider.model)}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                        selectedProvider === provider.id
                          ? theme === "dark" 
                            ? "bg-dark-border/60 text-white" 
                            : "bg-gray-100 text-gray-900"
                          : theme === "dark"
                            ? "text-gray-300 hover:bg-dark-border/40 hover:text-white"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span>{provider.name}</span>
                      </div>
                      {selectedProvider === provider.id && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stop button - shown during streaming */}
            {status === "streaming" && (
              <button
                type="button"
                onClick={() => stop()}
                className={`p-1.5 rounded-full ${
                  theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
                title="Stop generating"
              >
                <Square className="w-4 h-4" />
              </button>
            )}

            {/* Regenerate button - shown when ready and has messages */}
            {status === "ready" && messages.length > 0 && !error && (
              <button
                type="button"
                onClick={handleRegenerate}
                className={`p-1.5 rounded-full ${
                  theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
                title="Regenerate response"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            {/* Send button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`p-1.5 rounded-full ${
                isLoading
                  ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AIChat;
