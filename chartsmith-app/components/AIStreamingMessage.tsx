'use client';

import React from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { UIMessage } from 'ai';
import { useTheme } from '../contexts/ThemeContext';
import { Session } from '@/lib/types/session';
import { Loader2 } from 'lucide-react';

interface AIStreamingMessageProps {
  message: UIMessage;
  session: Session;
  isStreaming?: boolean;
}

export function AIStreamingMessage({ message, session, isStreaming }: AIStreamingMessageProps) {
  const { theme } = useTheme();

  // Extract text content from parts
  const textContent = message.parts
    ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('') || '';

  if (message.role === 'user') {
    return (
      <div className="px-2 py-1">
        <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-primary/20" : "bg-primary/10"} rounded-tr-sm w-full`}>
          <div className="flex items-start gap-2">
            <Image
              src={session.user.imageUrl}
              alt={session.user.name}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full flex-shrink-0"
            />
            <div className="flex-1">
              <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-[12px] pt-0.5`}>
                {textContent}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <div className="px-2 py-1">
        <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm w-full`}>
          <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              ChartSmith
              {isStreaming && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
            </div>
          </div>
          <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-[12px] markdown-content`}>
            {textContent ? (
              <ReactMarkdown>{textContent}</ReactMarkdown>
            ) : isStreaming ? (
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
                <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  generating response...
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
