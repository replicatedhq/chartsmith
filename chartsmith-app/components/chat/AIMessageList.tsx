"use client";

import React from "react";
import { type UIMessage } from "ai";
import { User, Bot } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import ReactMarkdown from "react-markdown";

export interface AIMessageListProps {
  /** Array of messages from useChat hook */
  messages: UIMessage[];
  /** Additional CSS class names */
  className?: string;
}

/**
 * AIMessageList Component
 * 
 * Renders the list of messages from the AI SDK useChat hook.
 * Supports parts-based rendering for text, tool calls, and tool results.
 * 
 * Message structure from AI SDK v5:
 * - role: 'user' | 'assistant' | 'system' | 'data' | 'tool'
 * - content: string (for simple text messages)
 * - parts: Array of { type: 'text' | 'tool-invocation' | etc., ... }
 */
export function AIMessageList({ messages, className = "" }: AIMessageListProps) {
  const { theme } = useTheme();

  return (
    <div className={`px-4 py-4 space-y-4 ${className}`}>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} theme={theme} />
      ))}
    </div>
  );
}

interface MessageItemProps {
  message: UIMessage;
  theme: string;
}

function MessageItem({ message, theme }: MessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`${message.role}-message`}
    >
      {/* Avatar for assistant */}
      {!isUser && (
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            theme === "dark" ? "bg-primary/20" : "bg-primary/10"
          }`}
        >
          <Bot
            className={`w-4 h-4 ${
              theme === "dark" ? "text-primary" : "text-primary"
            }`}
          />
        </div>
      )}

      {/* Message Content */}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? theme === "dark"
              ? "bg-primary/20 text-gray-200"
              : "bg-primary/10 text-gray-700"
            : theme === "dark"
              ? "bg-dark-border/40 text-gray-200"
              : "bg-gray-100 text-gray-700"
        }`}
      >
        {/* Render message content */}
        <MessageContent message={message} theme={theme} />
      </div>

      {/* Avatar for user */}
      {isUser && (
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            theme === "dark" ? "bg-dark-border/60" : "bg-gray-200"
          }`}
        >
          <User
            className={`w-4 h-4 ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}
          />
        </div>
      )}
    </div>
  );
}

interface MessageContentProps {
  message: UIMessage;
  theme: string;
}

function MessageContent({ message, theme }: MessageContentProps) {
  // AI SDK v5 uses parts array for message content
  if (message.parts && Array.isArray(message.parts)) {
    return (
      <div className="space-y-2">
        {message.parts.map((part, index) => (
          <MessagePart key={index} part={part as MessagePartType} theme={theme} />
        ))}
      </div>
    );
  }

  // If no parts, try to extract text from the message for display
  // This handles edge cases where the message structure might differ
  return (
    <div className="text-sm text-gray-400">
      (Empty message)
    </div>
  );
}

// Type for message parts in AI SDK v5
interface MessagePartType {
  type: string;
  text?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  output?: unknown;
  state?: string;
  [key: string]: unknown;
}

interface MessagePartProps {
  part: MessagePartType;
  theme: string;
}

function MessagePart({ part, theme }: MessagePartProps) {
  switch (part.type) {
    case "text":
      return (
        <div className="text-sm markdown-content prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{part.text || ""}</ReactMarkdown>
        </div>
      );

    case "tool-invocation":
      // Tool invocations will be fully handled in PR1.5
      return (
        <div
          className={`text-xs px-2 py-1 rounded ${
            theme === "dark"
              ? "bg-dark-border/60 text-gray-400"
              : "bg-gray-200 text-gray-500"
          }`}
        >
          🔧 {part.state === "call" ? "Calling" : "Tool"}: {part.toolName}
        </div>
      );

    case "reasoning":
      // Reasoning parts (if model supports it)
      return (
        <div
          className={`text-xs px-2 py-1 rounded italic ${
            theme === "dark"
              ? "bg-dark-border/40 text-gray-500"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          💭 {part.text}
        </div>
      );

    default:
      // Unknown part type - just render if it has text
      if (part.text) {
        return (
          <div className="text-sm">
            {part.text}
          </div>
        );
      }
      // Log for debugging
      console.warn("Unknown message part type:", part.type, part);
      return null;
  }
}

export default AIMessageList;
