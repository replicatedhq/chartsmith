/**
 * AI-powered Chat Container using Vercel AI SDK.
 * 
 * This component provides a modern chat experience with real-time streaming
 * using the Vercel AI SDK. It integrates with the existing Chartsmith
 * architecture while providing improved streaming performance.
 * 
 * Key features:
 * - Real-time streaming via AI SDK (not Centrifugo)
 * - Role-based prompting (auto/developer/operator)
 * - Integration with existing workspace context
 * - Fallback to existing ChatMessage components for complex workflows
 * 
 * Use this component for conversational chat. Plans, renders, and other
 * complex workflows continue to use the existing ChatContainer + Centrifugo.
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Send, Loader2, Users, Code, User, Sparkles, AlertCircle } from 'lucide-react';
import { useChat, Message as AIMessage } from '@ai-sdk/react';
import { useAtom } from 'jotai';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';

import { useTheme } from '../contexts/ThemeContext';
import { Session } from '@/lib/types/session';
import { workspaceAtom, messagesAtom } from '@/atoms/workspace';
import { ChatRole, ChartContext } from '@/lib/llm/system-prompts';
import { ScrollingContent } from './ScrollingContent';
import { toAIMessages } from '@/lib/llm/message-adapter';
import { saveAIChatMessageAction } from '@/lib/workspace/actions/save-ai-chat-message';

interface AIChatContainerProps {
  session: Session;
  /**
   * Initial messages to display (e.g., from database history).
   */
  initialMessages?: AIMessage[];
  /**
   * Callback when a message is successfully sent and response received.
   * Use this to persist messages to the database.
   */
  onMessageComplete?: (userMessage: AIMessage, assistantMessage: AIMessage) => void;
}

/**
 * Streaming chat message component.
 * Displays messages from the AI SDK with real-time streaming support.
 */
function StreamingMessage({
  message,
  session,
  theme,
  isStreaming,
}: {
  message: AIMessage;
  session: Session;
  theme: string;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className="space-y-2" data-testid="ai-chat-message">
      <div className="px-2 py-1">
        <div
          className={`p-3 rounded-lg ${
            isUser
              ? theme === 'dark'
                ? 'bg-primary/20'
                : 'bg-primary/10'
              : theme === 'dark'
              ? 'bg-dark-border/40'
              : 'bg-gray-100'
          } ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'} w-full`}
        >
          <div className="flex items-start gap-2">
            {isUser ? (
              <Image
                src={session.user.imageUrl}
                alt={session.user.name}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full flex-shrink-0"
              />
            ) : (
              <div
                className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                } mb-1`}
              >
                ChartSmith
              </div>
            )}
            <div className="flex-1">
              <div
                className={`${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                } text-[12px] pt-0.5 markdown-content`}
              >
                {isUser ? (
                  message.content
                ) : (
                  <>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                    {isStreaming && (
                      <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                    )}
                  </>
                )}
              </div>
              
              {/* Tool invocations */}
              {message.toolInvocations && message.toolInvocations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.toolInvocations.map((tool, index) => (
                    <div
                      key={index}
                      className={`text-xs px-2 py-1 rounded ${
                        theme === 'dark'
                          ? 'bg-dark-border/60 text-gray-400'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="font-mono">
                        {tool.toolName}
                        {tool.state === 'result' && `: ${JSON.stringify(tool.result)}`}
                        {tool.state === 'call' && '...'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIChatContainer({
  session,
  initialMessages = [],
  onMessageComplete,
}: AIChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom);
  const [existingMessages] = useAtom(messagesAtom);
  const [selectedRole, setSelectedRole] = useState<ChatRole>('auto');
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [lastUserInput, setLastUserInput] = useState<string>('');
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Convert existing database messages to AI SDK format for initial display
  const convertedInitialMessages = React.useMemo(() => {
    if (initialMessages.length > 0) {
      return initialMessages;
    }
    // Convert existing messages from Jotai atom
    return toAIMessages(existingMessages);
  }, [initialMessages, existingMessages]);

  // Build chart context from workspace
  const chartContext: ChartContext | undefined = React.useMemo(() => {
    if (!workspace?.charts?.length) {
      return undefined;
    }

    const chart = workspace.charts[0];

    return {
      structure: chart.files?.map((f) => `File: ${f.filePath}`).join('\n') || '',
      relevantFiles: chart.files?.slice(0, 10).map((f) => ({
        filePath: f.filePath,
        content: f.content || '',
      })),
    };
  }, [workspace]);

  // Configure useChat hook
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
  } = useChat({
    api: '/api/chat',
    initialMessages: convertedInitialMessages,
    body: {
      workspaceId: workspace?.id,
      role: selectedRole,
      chartContext,
    },
    onFinish: async (message: AIMessage) => {
      // Save the message to the database
      if (workspace?.id && lastUserInput) {
        try {
          await saveAIChatMessageAction(
            session,
            workspace.id,
            lastUserInput,
            message.content
          );
        } catch (err) {
          console.error('Failed to save AI chat message:', err);
        }
      }

      // Call the optional callback
      if (onMessageComplete) {
        const userMessage: AIMessage = {
          id: `user-${message.id}`,
          role: 'user',
          content: lastUserInput,
          createdAt: new Date(),
        };
        onMessageComplete(userMessage, message);
      }
    },
    onError: (error: Error) => {
      console.error('AI Chat error:', error);
    },
  });

  // Auto-respond to unanswered user messages (e.g., from initial workspace creation)
  const hasTriggeredInitialResponse = useRef(false);
  useEffect(() => {
    // Only trigger once per component mount
    if (hasTriggeredInitialResponse.current) return;
    
    // Check if there are messages and the last one is from the user (unanswered)
    if (messages.length > 0 && !isLoading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        hasTriggeredInitialResponse.current = true;
        // Store the user's prompt and trigger reload to get a response
        setLastUserInput(lastMessage.content);
        reload();
      }
    }
  }, [messages, isLoading, reload]);

  // Close role menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        roleMenuRef.current &&
        !roleMenuRef.current.contains(event.target as Node)
      ) {
        setIsRoleMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const getRoleLabel = (role: ChatRole): string => {
    switch (role) {
      case 'auto':
        return 'Auto-detect';
      case 'developer':
        return 'Chart Developer';
      case 'operator':
        return 'End User';
      default:
        return 'Auto-detect';
    }
  };

  const getRoleIcon = (role: ChatRole) => {
    switch (role) {
      case 'auto':
        return <Sparkles className="w-4 h-4" />;
      case 'developer':
        return <Code className="w-4 h-4" />;
      case 'operator':
        return <User className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    // Track the user input before submitting (for database persistence)
    setLastUserInput(input.trim());
    handleSubmit(e);
  };

  if (!workspace) {
    return null;
  }

  return (
    <div
      className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className="pb-32">
            {messages.map((message, index) => (
              <StreamingMessage
                key={message.id}
                message={message}
                session={session}
                theme={theme}
                isStreaming={isLoading && index === messages.length - 1 && message.role === 'assistant'}
              />
            ))}

            {/* Loading indicator when waiting for first token */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="px-2 py-1">
                <div
                  className={`p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-dark-border/40' : 'bg-gray-100'
                  } rounded-tl-sm w-full`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary" />
                    <div
                      className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      ChartSmith is thinking...
                    </div>
                    <button
                      onClick={stop}
                      className={`ml-auto text-xs px-1.5 py-0.5 rounded border ${
                        theme === 'dark'
                          ? 'border-dark-border text-gray-400 hover:text-gray-200'
                          : 'border-gray-300 text-gray-500 hover:text-gray-700'
                      } hover:bg-dark-border/40`}
                    >
                      cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="px-2 py-1">
                <div
                  className={`p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                  } border ${
                    theme === 'dark' ? 'border-red-800' : 'border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div
                        className={`text-sm ${
                          theme === 'dark' ? 'text-red-200' : 'text-red-800'
                        }`}
                      >
                        Something went wrong
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          theme === 'dark' ? 'text-red-300' : 'text-red-600'
                        }`}
                      >
                        {error.message}
                      </div>
                      <button
                        onClick={() => reload()}
                        className={`mt-2 text-xs px-2 py-1 rounded ${
                          theme === 'dark'
                            ? 'bg-red-800 text-red-200 hover:bg-red-700'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollingContent>
      </div>

      {/* Input area */}
      <div
        className={`absolute bottom-0 left-0 right-0 ${
          theme === 'dark' ? 'bg-dark-surface' : 'bg-white'
        } border-t ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}
      >
        <form onSubmit={onFormSubmit} className="p-3 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && input.trim()) {
                  onFormSubmit(e);
                }
              }
            }}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-24 text-sm rounded-md border resize-none overflow-hidden ${
              theme === 'dark'
                ? 'bg-dark border-dark-border/60 text-white placeholder-gray-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
          />

          <div className="absolute right-4 top-[18px] flex gap-2">
            {/* Role selector button */}
            <div ref={roleMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className={`p-1.5 rounded-full ${
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-dark-border/40'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                } ${selectedRole !== 'auto' ? 'bg-blue-500/10' : ''}`}
                title={`Perspective: ${getRoleLabel(selectedRole)}`}
              >
                {getRoleIcon(selectedRole)}
              </button>

              {/* Role selector dropdown */}
              {isRoleMenuOpen && (
                <div
                  className={`absolute bottom-full right-0 mb-1 w-56 rounded-lg shadow-lg border py-1 z-50 ${
                    theme === 'dark'
                      ? 'bg-dark-surface border-dark-border'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div
                    className={`px-3 py-2 text-xs font-medium ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    Ask questions from...
                  </div>
                  {(['auto', 'developer', 'operator'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role);
                        setIsRoleMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                        selectedRole === role
                          ? theme === 'dark'
                            ? 'bg-dark-border/60 text-white'
                            : 'bg-gray-100 text-gray-900'
                          : theme === 'dark'
                          ? 'text-gray-300 hover:bg-dark-border/40 hover:text-white'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role)}
                        <span>{getRoleLabel(role)}</span>
                      </div>
                      {selectedRole === role && (
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M5 13L9 17L19 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`p-1.5 rounded-full ${
                isLoading || !input.trim()
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
          </div>
        </form>
      </div>
    </div>
  );
}

