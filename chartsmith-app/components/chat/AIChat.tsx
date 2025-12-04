"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { Send, Loader2, Square, RefreshCw, AlertCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ProviderSelector } from "./ProviderSelector";
import { AIMessageList } from "./AIMessageList";
import { 
  type Provider, 
  getDefaultProvider, 
  getDefaultModelForProvider,
  STREAMING_THROTTLE_MS,
} from "@/lib/ai";

export interface AIChatProps {
  /** Optional initial messages */
  initialMessages?: UIMessage[];
  /** Optional callback when conversation starts */
  onConversationStart?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * AIChat Component
 * 
 * A NEW chat interface using Vercel AI SDK's useChat hook.
 * This runs PARALLEL to the existing Go-based chat system.
 * 
 * Features:
 * - Multi-provider support (OpenAI, Anthropic) via OpenRouter
 * - Provider selection locks after first message
 * - Real-time streaming responses
 * - Stop/regenerate controls
 * - Error handling with retry option
 */
export function AIChat({
  initialMessages = [],
  onConversationStart,
  className = "",
}: AIChatProps) {
  const { theme } = useTheme();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Provider state - locked after first message
  const [selectedProvider, setSelectedProvider] = useState<Provider>(getDefaultProvider);
  const [selectedModel, setSelectedModel] = useState<string>(() => 
    getDefaultModelForProvider(getDefaultProvider())
  );

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
      // Focus input after response completes
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle provider change
  const handleProviderChange = (provider: Provider, model: string) => {
    if (!canChangeProvider) return;
    setSelectedProvider(provider);
    setSelectedModel(model);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Notify that conversation is starting (for parent components)
    if (messages.length === 0 && onConversationStart) {
      onConversationStart();
    }

    // Send the message using AI SDK v5 API
    const messageText = input.trim();
    setInput(""); // Clear input immediately
    
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

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case "submitted":
        return "Thinking...";
      case "streaming":
        return "Responding...";
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex flex-col h-full ${
        theme === "dark" ? "bg-dark-surface" : "bg-white"
      } ${className}`}
    >
      {/* Header with Provider Selector */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          theme === "dark" ? "border-dark-border" : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              theme === "dark" ? "text-gray-200" : "text-gray-700"
            }`}
          >
            AI Chat
          </span>
          {!canChangeProvider && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                theme === "dark"
                  ? "bg-dark-border/40 text-gray-400"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ProviderSelector
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onProviderChange={handleProviderChange}
          disabled={!canChangeProvider}
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"
              }`}
            >
              <Send
                className={`w-6 h-6 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
            </div>
            <h3
              className={`text-lg font-medium mb-2 ${
                theme === "dark" ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Start a conversation
            </h3>
            <p
              className={`text-sm max-w-sm ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Ask questions about Helm charts, Kubernetes configurations, or get help creating and modifying your charts.
            </p>
          </div>
        ) : (
          <AIMessageList messages={messages} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div
          className={`mx-4 mb-2 p-3 rounded-lg flex items-start gap-2 ${
            theme === "dark"
              ? "bg-red-900/20 border border-red-800/50"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 flex-shrink-0 ${
              theme === "dark" ? "text-red-400" : "text-red-500"
            }`}
          />
          <div className="flex-1">
            <p
              className={`text-sm ${
                theme === "dark" ? "text-red-300" : "text-red-700"
              }`}
            >
              {error.message || "An error occurred. Please try again."}
            </p>
            <button
              onClick={handleRegenerate}
              className={`text-xs mt-1 underline ${
                theme === "dark"
                  ? "text-red-400 hover:text-red-300"
                  : "text-red-600 hover:text-red-700"
              }`}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Status Indicator */}
      {getStatusText() && (
        <div
          className={`px-4 py-2 text-xs flex items-center gap-2 ${
            theme === "dark" ? "text-gray-400" : "text-gray-500"
          }`}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{getStatusText()}</span>
        </div>
      )}

      {/* Input Area */}
      <div
        className={`border-t ${
          theme === "dark" ? "border-dark-border" : "border-gray-200"
        }`}
      >
        <form onSubmit={handleFormSubmit} className="p-3 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Helm charts..."
            rows={3}
            style={{ height: "auto", minHeight: "72px", maxHeight: "150px" }}
            className={`w-full px-3 py-2 pr-24 text-sm rounded-md border resize-none ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
            disabled={isLoading}
          />

          {/* Action Buttons */}
          <div className="absolute right-4 top-[18px] flex items-center gap-1">
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

            {/* Regenerate button - shown when not streaming and has messages */}
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
              disabled={isLoading || !input.trim()}
              className={`p-1.5 rounded-full ${
                isLoading || !input.trim()
                  ? theme === "dark"
                    ? "text-gray-600 cursor-not-allowed"
                    : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AIChat;
