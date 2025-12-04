"use client";

import React from "react";
import type { UIMessage } from "ai";
import { useTheme } from "@/contexts/ThemeContext";
import ReactMarkdown from "react-markdown";
import { Loader2, User, Bot } from "lucide-react";

interface ConversationalMessageProps {
  message: UIMessage;
  isLoading?: boolean;
}

// Helper function to extract text content from UIMessage parts
function getMessageText(message: UIMessage): string {
  if (!message.parts || message.parts.length === 0) {
    return '';
  }
  
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('');
}

export function ConversationalMessage({ message, isLoading }: ConversationalMessageProps) {
  const { theme } = useTheme();
  const isUser = message.role === "user";
  const content = getMessageText(message);

  return (
    <div
      className={`px-4 py-3 ${
        isUser
          ? theme === "dark"
            ? "bg-dark-surface"
            : "bg-gray-50"
          : theme === "dark"
          ? "bg-dark"
          : "bg-white"
      }`}
    >
      <div className="flex gap-3 max-w-3xl mx-auto">
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
            isUser
              ? theme === "dark"
                ? "bg-primary/20 text-primary"
                : "bg-primary/10 text-primary"
              : theme === "dark"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-emerald-500/10 text-emerald-600"
          }`}
        >
          {isUser ? (
            <User className="w-3.5 h-3.5" />
          ) : (
            <Bot className="w-3.5 h-3.5" />
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-[11px] font-medium mb-1 ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {isUser ? "You" : "ChartSmith"}
          </div>
          <div
            className={`text-[12px] ${
              theme === "dark" ? "text-gray-200" : "text-gray-700"
            } markdown-content`}
          >
            {isLoading && !content ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-gray-500">Thinking...</span>
              </div>
            ) : (
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => (
                    <h1
                      className="text-xl font-semibold mt-4 mb-2"
                      {...props}
                    />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2
                      className="text-lg font-semibold mt-4 mb-2"
                      {...props}
                    />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3
                      className="text-base font-semibold mt-4 mb-2"
                      {...props}
                    />
                  ),
                  h4: ({ node, ...props }) => (
                    <h4
                      className="text-sm font-semibold mt-4 mb-2"
                      {...props}
                    />
                  ),
                  p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc list-inside my-2" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal my-2 pl-8" {...props} />
                  ),
                  code: ({ node, className, children, ...props }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code
                          className={`font-mono text-[11px] px-1 py-0.5 rounded ${
                            theme === "dark"
                              ? "bg-dark-border/40"
                              : "bg-gray-100"
                          }`}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="font-mono text-[11px]" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ node, ...props }) => (
                    <pre
                      className={`p-3 rounded-md my-2 overflow-x-auto text-[11px] ${
                        theme === "dark"
                          ? "bg-dark-border/40"
                          : "bg-gray-100"
                      }`}
                      {...props}
                    />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
