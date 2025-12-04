"use client";

import React from "react";
import { type UIMessage } from "ai";
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
 * Renders messages in the same style as ChatMessage.tsx for visual consistency.
 * Uses the same px-2 py-1 padding, bg-primary/20 for user, bg-dark-border/40 for assistant.
 */
export function AIMessageList({ messages, className = "" }: AIMessageListProps) {
  const { theme } = useTheme();

  return (
    <div className={`${className}`}>
      {messages.map((message) => (
        <AIMessageItem key={message.id} message={message} theme={theme} />
      ))}
    </div>
  );
}

interface AIMessageItemProps {
  message: UIMessage;
  theme: string;
}

function AIMessageItem({ message, theme }: AIMessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div className="space-y-2" data-testid="chat-message">
      {isUser ? (
        // User Message - matches ChatMessage.tsx exactly
        <div className="px-2 py-1" data-testid="user-message">
          <div className={`p-3 rounded-lg ${
            theme === "dark" ? "bg-primary/20" : "bg-primary/10"
          } rounded-tr-sm w-full`}>
            <div className="flex items-start gap-2">
              {/* User avatar placeholder */}
              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                theme === "dark" ? "bg-primary/40 text-white" : "bg-primary/30 text-gray-700"
              }`}>
                U
              </div>
              <div className="flex-1">
                <div className={`${
                  theme === "dark" ? "text-gray-200" : "text-gray-700"
                } text-[12px] pt-0.5`}>
                  <MessageContent message={message} theme={theme} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Assistant Message - matches ChatMessage.tsx exactly
        <div className="px-2 py-1" data-testid="assistant-message">
          <div className={`p-3 rounded-lg ${
            theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"
          } rounded-tl-sm w-full`}>
            <div className={`text-xs ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            } mb-1`}>
              ChartSmith
            </div>
            <div className={`${
              theme === "dark" ? "text-gray-200" : "text-gray-700"
            } text-[12px] markdown-content`}>
              <MessageContent message={message} theme={theme} />
            </div>
          </div>
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

  return <div className="text-gray-400">(Empty message)</div>;
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
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{part.text || ""}</ReactMarkdown>
        </div>
      );

    case "tool-invocation":
      // Tool invocations will be fully handled in PR1.5
      return (
        <div className={`text-xs px-2 py-1 rounded inline-block ${
          theme === "dark"
            ? "bg-dark-border/60 text-gray-400"
            : "bg-gray-200 text-gray-500"
        }`}>
          🔧 {part.state === "call" ? "Calling" : "Tool"}: {part.toolName}
        </div>
      );

    case "reasoning":
      return (
        <div className={`text-xs px-2 py-1 rounded italic ${
          theme === "dark"
            ? "bg-dark-border/40 text-gray-500"
            : "bg-gray-100 text-gray-400"
        }`}>
          💭 {part.text}
        </div>
      );

    default:
      if (part.text) {
        return <div className="text-sm">{part.text}</div>;
      }
      return null;
  }
}

export default AIMessageList;
