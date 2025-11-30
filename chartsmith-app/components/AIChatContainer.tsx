"use client";
import React, { useEffect } from "react";
import { useChat } from 'ai/react';
import { useAtom } from "jotai";
import { Send, Loader2 } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { workspaceAtom } from "@/atoms/workspace";
import { aiProviderAtom, aiModelAtom } from "@/atoms/ai-provider";
import { ScrollingContent } from "./ScrollingContent";
import { ProviderSelector } from "./ProviderSelector";
import { ModelSelector } from "./ModelSelector";

interface AIChatContainerProps {
  session: Session;
  workspaceId: string;
  messageFromPersona?: string;
}

/**
 * AI-powered chat container using Vercel AI SDK
 * This is used for conversational Q&A about the chart
 */
export function AIChatContainer({ session, workspaceId, messageFromPersona = 'auto' }: AIChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom);
  const [provider] = useAtom(aiProviderAtom);
  const [model] = useAtom(aiModelAtom);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/ai-chat',
    body: {
      workspaceId,
      provider,
      model,
      sessionId: session.id,
      messageFromPersona,
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className="pb-32 px-4">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`my-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div
                  className={`inline-block max-w-[80%] p-4 rounded-lg ${
                    message.role === 'user'
                      ? theme === "dark"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-500 text-white"
                      : theme === "dark"
                      ? "bg-dark-hover text-dark-text"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="my-4 text-left">
                <div className={`inline-block p-4 rounded-lg ${
                  theme === "dark" ? "bg-dark-hover" : "bg-gray-100"
                }`}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}
            {error && (
              <div className="my-4 text-center">
                <div className="inline-block p-4 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
                  Error: {error.message}
                </div>
              </div>
            )}
          </div>
        </ScrollingContent>
      </div>
      
      <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        {/* AI Provider and Model Selection */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2 border-b border-gray-200/50 dark:border-dark-border/50">
          <div className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            AI Model:
          </div>
          <ProviderSelector />
          <ModelSelector />
        </div>
        
        <form onSubmit={handleSubmit} className="p-3 relative">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading) {
                  handleSubmit(e);
                }
              }
            }}
            placeholder="Ask a question about your Helm chart..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-16 text-sm rounded-md border resize-none overflow-hidden ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
          />
          <div className="absolute right-4 top-[18px]">
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`p-1.5 rounded-full ${
                isLoading || !input.trim()
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

