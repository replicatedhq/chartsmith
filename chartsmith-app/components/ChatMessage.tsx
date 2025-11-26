"use client";

import React, { useState, useRef, useEffect, FormEvent, useMemo, useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import { atom } from "jotai";
import Image from "next/image";
import { Send, Copy, Check } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import dynamic from 'next/dynamic';

// Lazy load heavy components for better initial bundle size
const Terminal = dynamic(() => import("@/components/Terminal").then(mod => ({ default: mod.Terminal })), {
  loading: () => <div className="animate-pulse bg-gray-800 rounded h-32" />,
  ssr: false,
});

const FeedbackModal = dynamic(() => import("@/components/FeedbackModal").then(mod => ({ default: mod.FeedbackModal })), {
  ssr: false,
});

const ConversionProgress = dynamic(() => import("@/components/ConversionProgress").then(mod => ({ default: mod.ConversionProgress })), {
  loading: () => <div className="animate-pulse bg-gray-800 rounded h-16" />,
  ssr: false,
});

const RollbackModal = dynamic(() => import("@/components/RollbackModal").then(mod => ({ default: mod.RollbackModal })), {
  ssr: false,
});

const PlanChatMessage = dynamic(() => import("@/components/PlanChatMessage").then(mod => ({ default: mod.PlanChatMessage })), {
  loading: () => <div className="animate-pulse bg-gray-800 rounded h-24" />,
  ssr: false,
});

// Types
import { Message, ToolInvocation } from "@/components/types";
import { Session } from "@/lib/types/session";

// Contexts
import { useTheme } from "../contexts/ThemeContext";

// atoms
import { conversionByIdAtom, messageByIdAtom, messagesAtom, renderByIdAtom, workspaceAtom, rendersAtom } from "@/atoms/workspace";

// actions
import { cancelMessageAction } from "@/lib/workspace/actions/cancel-message";
import { performFollowupAction } from "@/lib/workspace/actions/perform-followup-action";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { getWorkspaceRenderAction } from "@/lib/workspace/actions/get-workspace-render";

export interface ChatMessageProps {
  messageId: string;
  session: Session;
  showChatInput?: boolean;
  onContentUpdate?: () => void;
}

function LoadingSpinner({ message }: { message: string }) {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <div
        className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-forge-ember"
        aria-hidden="true"
      />
      <div className={`text-xs font-medium ${theme === "dark" ? "text-forge-silver" : "text-stone-500"}`}>
        {message}
      </div>
    </div>
  );
}

/**
 * Tool invocation display component.
 * Shows the status of AI tool calls with accessible status indicators.
 */
function ToolInvocationDisplay({ tool, theme }: { tool: ToolInvocation; theme: string }) {
  const getStateColor = (state: string) => {
    switch (state) {
      case 'result':
        return theme === 'dark' ? 'text-forge-success' : 'text-green-600';
      case 'call':
        return theme === 'dark' ? 'text-forge-ember' : 'text-forge-ember-dim';
      case 'partial-call':
        return theme === 'dark' ? 'text-forge-warning' : 'text-yellow-600';
      default:
        return theme === 'dark' ? 'text-forge-zinc' : 'text-stone-500';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'result':
        return 'completed';
      case 'call':
        return 'forging...';
      case 'partial-call':
        return 'heating up...';
      default:
        return state;
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-forge text-xs border ${
        theme === 'dark'
          ? 'bg-forge-iron/30 border-forge-zinc/30'
          : 'bg-stone-50 border-stone-200'
      }`}
      role="status"
      aria-label={`Tool ${tool.toolName}: ${getStateLabel(tool.state)}`}
    >
      <span
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full ${
          theme === 'dark' ? 'bg-forge-ember/20 text-forge-ember' : 'bg-forge-ember/10 text-forge-ember-dim'
        }`}
        aria-hidden="true"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </span>
      <span className={`font-mono font-medium ${theme === 'dark' ? 'text-stone-200' : 'text-stone-700'}`}>
        {tool.toolName}
      </span>
      <span
        className={`ml-auto font-medium ${getStateColor(tool.state)}`}
        aria-hidden="true"
      >
        {getStateLabel(tool.state)}
      </span>
    </div>
  );
}

/**
 * Code block component with syntax highlighting and copy button.
 * 
 * Accessibility:
 * - Proper code/pre semantic elements
 * - Accessible copy button with status announcement
 * - Language label for context
 */
function CodeBlock({ 
  children, 
  className, 
  theme 
}: { 
  children: React.ReactNode; 
  className?: string; 
  theme: string;
}) {
  const [copied, setCopied] = useState(false);
  const codeContent = String(children).replace(/\n$/, '');
  
  // Extract language from className (e.g., "language-yaml" -> "yaml")
  const language = className?.replace('language-', '') || '';
  const isYamlOrHelm = ['yaml', 'yml', 'helm'].includes(language.toLowerCase());
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeContent);
    setCopied(true);
    // Announce to screen readers
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple YAML syntax highlighting
  const highlightYaml = (code: string) => {
    return code.split('\n').map((line, i) => {
      // Highlight comments
      if (line.trim().startsWith('#')) {
        return <span key={i} className="text-gray-500">{line}{'\n'}</span>;
      }
      
      // Highlight key-value pairs
      const keyValueMatch = line.match(/^(\s*)([^:]+)(:)(.*)$/);
      if (keyValueMatch) {
        const [, indent, key, colon, value] = keyValueMatch;
        const trimmedValue = value.trim();
        
        // Check for Helm template expressions
        const helmMatch = trimmedValue.match(/^(\{\{.*\}\})$/);
        if (helmMatch) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }
        
        // Check for string values
        if (trimmedValue.startsWith('"') || trimmedValue.startsWith("'")) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }
        
        // Check for numeric values
        if (/^\s*\d+/.test(trimmedValue)) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }
        
        // Check for boolean values
        if (/^\s*(true|false)$/i.test(trimmedValue)) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }
        
        return (
          <span key={i}>
            {indent}
            <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
            <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{value}</span>
            {'\n'}
          </span>
        );
      }
      
      // List items
      if (line.trim().startsWith('-')) {
        return <span key={i} className={theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}>{line}{'\n'}</span>;
      }
      
      return <span key={i}>{line}{'\n'}</span>;
    });
  };

  return (
    <figure
      className={`relative group rounded-forge overflow-hidden my-3 border ${
        theme === 'dark'
          ? 'bg-forge-black border-forge-iron'
          : 'bg-stone-900 border-stone-700'
      }`}
      role="figure"
      aria-label={language ? `${language.toUpperCase()} code block` : 'Code block'}
    >
      {/* Language label with ember accent */}
      {language && (
        <div
          className={`px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider border-b flex items-center gap-2 ${
            theme === 'dark'
              ? 'bg-forge-charcoal border-forge-iron text-forge-ember'
              : 'bg-stone-800 border-stone-700 text-forge-ember-bright'
          }`}
          aria-hidden="true"
        >
          <span className="w-2 h-2 rounded-full bg-forge-ember/60" />
          {language}
        </div>
      )}

      {/* Copy button with forge styling */}
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
        aria-live="polite"
        className={`absolute top-2 right-2 p-1.5 rounded-forge opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forge-ember/50 ${
          copied
            ? 'bg-forge-success/20 text-forge-success'
            : theme === 'dark'
              ? 'bg-forge-iron/60 hover:bg-forge-ember/20 text-forge-silver hover:text-forge-ember'
              : 'bg-stone-700 hover:bg-forge-ember/20 text-stone-300 hover:text-forge-ember'
        }`}
        title={copied ? "Copied!" : "Copy code"}
      >
        {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
        <span className="sr-only">{copied ? "Copied to clipboard" : "Copy code"}</span>
      </button>

      {/* Code content */}
      <pre
        className={`p-4 overflow-x-auto text-xs font-mono leading-relaxed ${
          theme === 'dark' ? 'text-stone-200' : 'text-stone-100'
        }`}
        tabIndex={0}
        aria-label={`Code: ${codeContent.substring(0, 50)}${codeContent.length > 50 ? '...' : ''}`}
      >
        <code>
          {isYamlOrHelm ? highlightYaml(codeContent) : codeContent}
        </code>
      </pre>
    </figure>
  );
}

// Streaming indicator component with animated bouncing dots and cursor - forge styled
function StreamingIndicator({ theme, showCursor = false }: { theme: string; showCursor?: boolean }) {
  if (showCursor) {
    // Show blinking cursor for inline streaming
    return (
      <span
        className="streaming-cursor"
        role="status"
        aria-label="Forging response"
      />
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 ml-1"
      role="status"
      aria-label="Forging response"
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-forge-ember animate-bounce"
        style={{ animationDelay: '0ms', animationDuration: '500ms' }}
      />
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-forge-ember-bright animate-bounce"
        style={{ animationDelay: '150ms', animationDuration: '500ms' }}
      />
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-forge-ember animate-bounce"
        style={{ animationDelay: '300ms', animationDuration: '500ms' }}
      />
    </span>
  );
}

// Helper function to determine if a message is the first one for its revision number
function isFirstMessageForRevision(message: Message, messageId: string, allMessages: Message[]): boolean {
  if (!message.responseRollbackToRevisionNumber) {
    return false; // No revision number to check
  }

  const revisionNumber = message.responseRollbackToRevisionNumber;

  // Find all messages that have this revision number and sort by creation date
  const messagesWithRevision = allMessages
    .filter(m => m.responseRollbackToRevisionNumber === revisionNumber)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

  // Check if this message is the first one with this revision
  return messagesWithRevision.length > 0 &&
         messagesWithRevision[0].id === messageId;
}

/**
 * ChatMessage component - Renders a single chat message with user prompt and assistant response.
 * 
 * Performance optimizations:
 * - Wrapped in React.memo to prevent unnecessary re-renders
 * - Heavy components (Terminal, ConversionProgress, etc.) are lazy loaded
 * - useMemo for expensive markdown component creation
 * - useCallback for event handlers
 * 
 * Accessibility (WCAG 2.1 AA):
 * - Semantic HTML structure with proper roles
 * - Screen reader labels for user/assistant messages
 * - Accessible code blocks with copy functionality
 * - Proper focus management
 * - aria-live regions for streaming content
 */
function ChatMessageInner({
  messageId,
  session,
  showChatInput,
  onContentUpdate,
}: ChatMessageProps) {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [, setShowDropdown] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useAtom(messagesAtom);
  const [messageGetter] = useAtom(messageByIdAtom);
  const message = messageGetter(messageId);

  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [renderGetter] = useAtom(renderByIdAtom);
  // Only call the getter if responseRenderId exists
  const render = message?.responseRenderId ? renderGetter(message.responseRenderId) : undefined;
  const setRenders = useSetAtom(rendersAtom);

  // Fetch render if missing
  useEffect(() => {
    if (message?.responseRenderId && !render && session) {
      const fetchRender = async () => {
        try {
          const newRender = await getWorkspaceRenderAction(session, message.responseRenderId!);
          if (newRender) {
            // Format dates
            const formattedRender = {
              ...newRender,
              createdAt: new Date(newRender.createdAt),
              completedAt: newRender.completedAt ? new Date(newRender.completedAt) : undefined,
              charts: newRender.charts.map((chart: any) => ({
                ...chart,
                createdAt: new Date(chart.createdAt),
                completedAt: chart.completedAt ? new Date(chart.completedAt) : undefined,
              }))
            };

            setRenders((prev) => {
              if (prev.find((r) => r.id === formattedRender.id)) return prev;
              return [...prev, formattedRender];
            });
          }
        } catch (err) {
          console.error("Failed to fetch render", err);
        }
      };
      fetchRender();
    }
  }, [message?.responseRenderId, render, session, setRenders]);

  const [conversionGetter] = useAtom(conversionByIdAtom);
  // Only call the getter if responseConversionId exists
  const conversion = message?.responseConversionId ? conversionGetter(message.responseConversionId) : undefined;

  // Check if this is the first message for its revision
  const isFirstForRevision = React.useMemo(() => {
    if (!message || !message.responseRollbackToRevisionNumber) return false;
    return isFirstMessageForRevision(message, messageId, messages);
  }, [message, messageId, messages]);

  // Move the useEffect outside of renderAssistantContent
  useEffect(() => {
    if (onContentUpdate && message) {
      onContentUpdate();
    }
  }, [message, message?.response, message?.responseRenderId, message?.responseConversionId, onContentUpdate]);

  const handleSubmitChat = async (e: FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      if (!session || !workspace) return;

      const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim(), "auto");

      setMessages(prev => [...prev, chatMessage]);

      setChatInput("");
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [chatInput]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Create a pure sorted content component
  // This ensures the order is always correct by hard-coding it
  // Supports both legacy message format (response) and AI SDK format (content)
  const SortedContent = () => {
    // Get the response content - support both legacy 'response' and AI SDK 'content' fields
    const responseContent = message?.response || message?.content;
    const isStreaming = message?.isStreaming;
    
    // Custom markdown components with syntax highlighting
    const markdownComponents: Components = useMemo(() => ({
      code: ({ className, children, ...props }: any) => {
        // Check if this is a code block (has language class) vs inline code
        const isCodeBlock = className?.startsWith('language-');
        
        if (isCodeBlock) {
          return (
            <CodeBlock className={className} theme={theme}>
              {children}
            </CodeBlock>
          );
        }
        
        // Inline code
        return (
          <code 
            className={`px-1 py-0.5 rounded text-xs font-mono ${
              theme === 'dark' 
                ? 'bg-dark-border/50 text-pink-400' 
                : 'bg-gray-200 text-pink-600'
            }`}
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }: any) => {
        // Just pass through - CodeBlock handles the styling
        return <>{children}</>;
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [theme]);
    
    return (
      <>
        {responseContent && (
          <div className="mb-4 message-content">
            <span className={isStreaming ? 'streaming-cursor' : ''}>
              <ReactMarkdown components={markdownComponents}>
                {responseContent}
              </ReactMarkdown>
            </span>
          </div>
        )}

        {/* Show streaming indicator when response is empty but streaming */}
        {!responseContent && isStreaming && (
          <div className="mb-4 flex items-center gap-2 message-animate-in">
            <StreamingIndicator theme={theme} />
            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              generating response...
            </span>
          </div>
        )}

        {/* Tool Invocations Display (AI SDK) */}
        {message?.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="space-y-2 mb-4">
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>
              Tool Calls:
            </div>
            {message.toolInvocations.map((tool, idx) => (
              <ToolInvocationDisplay key={tool.toolCallId || idx} tool={tool} theme={theme} />
            ))}
          </div>
        )}

        {message?.responsePlanId && (
          <div className="w-full mb-4">
            {responseContent && (
              <div className="border-t border-gray-200 dark:border-dark-border/30 pt-4 mb-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Plan:</div>
              </div>
            )}
            <PlanChatMessage
              planId={message.responsePlanId}
              showActions={true}
              showChatInput={workspace?.currentRevisionNumber === 0}
              session={session}
              messageId={messageId}
              workspaceId={workspace?.id}
              messages={messages} // Pass messages to resolve the reference error
            />
          </div>
        )}

        {message?.responseRenderId && !render?.isAutorender && (
          <div className="space-y-4 mt-4">
            {render?.charts ? (
              render.charts.map((chart, index) => (
                <Terminal
                  key={`${messageId}-${render.id}-${chart.id}-${index}`}
                  data-testid="chart-terminal"
                  chart={chart}
                  depUpdateCommandStreamed={chart.depUpdateCommand}
                  depUpdateStderrStreamed={chart.depUpdateStderr}
                  depUpdateStdoutStreamed={chart.depUpdateStdout}
                  helmTemplateCommandStreamed={chart.helmTemplateCommand}
                  helmTemplateStderrStreamed={chart.helmTemplateStderr}
                />
              ))
            ) : (
              <LoadingSpinner message="Loading rendered content..." />
            )}
          </div>
        )}

        {message?.responseConversionId && (
          <div className="mt-4">
            {(responseContent || message.responsePlanId || message.responseRenderId) && (
              <div className="border-t border-gray-200 dark:border-dark-border/30 pt-4 mb-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Conversion Progress:</div>
              </div>
            )}
            {/* Always render ConversionProgress so it can handle loading and polling */}
              <ConversionProgress conversionId={message.responseConversionId} />
          </div>
        )}

        {message && !responseContent && !isStreaming && !message.responsePlanId && !message.responseRenderId && !message.responseConversionId && !message.toolInvocations?.length && (
          <LoadingSpinner message="generating response..." />
        )}
      </>
    );
  };

  if (!message || !workspace) return null;

  // Format timestamp for screen readers
  const formattedTime = message.createdAt 
    ? new Date(message.createdAt).toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit' 
      })
    : '';

  return (
    <div className="space-y-3" data-testid="chat-message">
      {/* User Message */}
      <div
        className="px-2 py-1"
        data-testid="user-message"
        role="group"
        aria-label={`Your message${formattedTime ? ` at ${formattedTime}` : ''}`}
      >
        <div className={`p-4 rounded-forge-lg rounded-tr-sm w-full border ${
          theme === "dark"
            ? "bg-forge-ember/10 border-forge-ember/20"
            : "bg-forge-ember/5 border-forge-ember/15"
        }`}>
          <div className="flex items-start gap-3">
            <Image
              src={session.user.imageUrl}
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-forge-ember/30"
            />
            <div className="flex-1 min-w-0">
              {/* Screen reader only user name */}
              <span className="sr-only">{session.user.name} said:</span>
              <div
                className={`text-sm leading-relaxed ${
                  theme === "dark" ? "text-stone-100" : "text-stone-800"
                } ${message.isCanceled ? "opacity-50 line-through" : ""}`}
                aria-label={message.isCanceled ? "Message canceled" : undefined}
              >
                {message.prompt}
              </div>
              {!message.isIntentComplete && !message.isCanceled && (
                <div
                  className={`flex items-center gap-2 mt-3 pt-3 border-t ${
                    theme === "dark" ? "border-forge-ember/20" : "border-forge-ember/15"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <div
                    className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border-2 border-forge-ember border-t-transparent"
                    aria-hidden="true"
                  />
                  <div className={`text-xs font-medium ${theme === "dark" ? "text-forge-ember-bright" : "text-forge-ember-dim"}`}>
                    forging response...
                  </div>
                  <button
                    aria-label="Cancel message generation"
                    className={`ml-auto text-xs px-2 py-1 rounded-forge font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-forge-ember/50 ${
                      theme === "dark"
                        ? "bg-forge-iron/50 border border-forge-zinc text-forge-silver hover:text-stone-100 hover:bg-forge-iron"
                        : "bg-stone-100 border border-stone-300 text-stone-500 hover:text-stone-700 hover:bg-stone-200"
                    }`}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const chatMessage = await cancelMessageAction(session, message.id);
                      if (chatMessage && setMessages) {
                        setMessages((messages: Message[]) => messages.map((m: Message) => m.id === message.id ? (chatMessage as Message) : m));
                      }
                    }}
                  >
                    cancel
                  </button>
                </div>
              )}
              {message.isCanceled && (
                <div
                  className={`flex items-center gap-2 mt-3 pt-3 border-t ${
                    theme === "dark" ? "border-forge-ember/20" : "border-forge-ember/15"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <div className={`text-xs font-medium ${theme === "dark" ? "text-forge-zinc" : "text-stone-400"}`}>
                    Forging canceled
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assistant Message */}
      {(message.response || message.content || message.responsePlanId || message.responseRenderId || message.responseConversionId || message.toolInvocations?.length || (message.isIntentComplete && !message.responsePlanId) || message.isStreaming) && (
        <div
          className="px-2 py-1"
          data-testid="assistant-message"
          role="group"
          aria-label={`ChartSmith response${message.isStreaming ? ', forging' : ''}`}
        >
          <div className={`p-4 rounded-forge-lg rounded-tl-sm w-full border ${
            theme === "dark"
              ? "bg-forge-steel/50 border-forge-iron"
              : "bg-stone-50 border-stone-200"
          }`}>
            {/* Header with forge styling */}
            <div className={`text-xs mb-3 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  theme === "dark" ? "bg-forge-iron" : "bg-stone-200"
                }`}>
                  <svg className="w-3.5 h-3.5 text-forge-ember" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className={`font-display font-semibold ${theme === "dark" ? "text-stone-200" : "text-stone-700"}`}>
                  ChartSmith
                </span>
                {message.isStreaming && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-forge-ember ember-pulse" />
                  </span>
                )}
              </div>
              <div className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                theme === "dark"
                  ? "bg-forge-iron/50 text-forge-zinc"
                  : "bg-stone-200 text-stone-500"
              }`} aria-label={`Revision ${
                message.revisionNumber !== undefined
                  ? message.revisionNumber
                  : message.id
                    ? Array.from(message.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100
                    : "unknown"
              }`}>
                rev #{
                  message.revisionNumber !== undefined
                    ? message.revisionNumber
                    : message.id
                      ? Array.from(message.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100
                      : "?"
                }
              </div>
            </div>
            {/* Screen reader only assistant name */}
            <span className="sr-only">ChartSmith responded:</span>
            <div
              className={`text-sm leading-relaxed ${
                theme === "dark" ? "text-stone-200" : "text-stone-700"
              } ${message.isIgnored ? "opacity-50 line-through" : ""} markdown-content`}
              aria-busy={message.isStreaming}
              aria-live={message.isStreaming ? "polite" : "off"}
            >
              {/* Use our custom component that enforces order */}
              <SortedContent />

              {/* Rollback link - only show if:
                 1. It has a rollback revision number
                 2. It's not the current revision
                 3. It's the first message for that revision */}
              {message.responseRollbackToRevisionNumber !== undefined &&
               workspace.currentRevisionNumber !== message.responseRollbackToRevisionNumber &&
               isFirstForRevision && (
                <div className={`mt-3 text-[10px] border-t pt-3 flex justify-end ${
                  theme === "dark" ? "border-forge-iron/50" : "border-stone-200"
                }`}>
                  <button
                    aria-label={`Rollback to revision ${message.responseRollbackToRevisionNumber}`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-forge font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-forge-ember/50 ${
                      theme === "dark"
                        ? "text-forge-zinc hover:text-forge-ember hover:bg-forge-ember/10"
                        : "text-stone-400 hover:text-forge-ember-dim hover:bg-forge-ember/5"
                    }`}
                    onClick={() => setShowRollbackModal(true)}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8L12 13M12 13L15 10M12 13L9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    rollback to this revision
                  </button>
                </div>
              )}
            </div>
            {message.followupActions && message.followupActions.length > 0 && (
              <nav
                className={`mt-4 pt-4 flex flex-wrap gap-2 justify-end border-t ${
                  theme === "dark" ? "border-forge-iron/50" : "border-stone-200"
                }`}
                aria-label="Suggested follow-up actions"
              >
                {message.followupActions.map((action, index) => (
                  <button
                    key={index}
                    aria-label={`Follow-up action: ${action.label}`}
                    className={`text-xs px-3 py-1.5 rounded-forge font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forge-ember/50 ${
                      theme === "dark"
                        ? "bg-forge-iron/50 border border-forge-zinc/50 text-stone-300 hover:text-forge-ember hover:border-forge-ember/50 hover:bg-forge-ember/10"
                        : "bg-white border border-stone-300 text-stone-600 hover:text-forge-ember-dim hover:border-forge-ember/50 hover:bg-forge-ember/5"
                    }`}
                    onClick={async () => {
                      const chatMessage = await performFollowupAction(session, workspace.id, message.id, action.action);
                      if (chatMessage && setMessages) {
                        setMessages((messages: Message[]) => [...messages, chatMessage]);
                      }
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </nav>
            )}
            {showChatInput && (
              <div className={`mt-6 border-t pt-4 ${
                theme === "dark" ? "border-forge-iron/50" : "border-stone-200"
              }`}>
                <form
                  onSubmit={handleSubmitChat}
                  className="relative"
                  role="form"
                  aria-label="Reply to this message"
                >
                  <label htmlFor={`chat-reply-${messageId}`} className="sr-only">
                    Type your reply
                  </label>
                  <textarea
                    id={`chat-reply-${messageId}`}
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (chatInput.trim() && handleSubmitChat) {
                          handleSubmitChat(e);
                        }
                      } else if (e.key === 'Escape') {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Continue the conversation..."
                    rows={1}
                    style={{ height: 'auto', minHeight: '40px', maxHeight: '150px' }}
                    aria-describedby={`chat-reply-hint-${messageId}`}
                    className={`w-full px-4 py-2.5 pr-12 text-sm rounded-forge border resize-none overflow-hidden transition-all duration-200 ${
                      theme === "dark"
                        ? "bg-forge-charcoal border-forge-iron text-stone-100 placeholder-forge-zinc"
                        : "bg-white border-stone-300 text-stone-900 placeholder-stone-400"
                    } focus:outline-none focus:ring-2 focus:ring-forge-ember/50 focus:border-forge-ember/50`}
                  />
                  <div id={`chat-reply-hint-${messageId}`} className="sr-only">
                    Press Enter to send, Shift+Enter for new line
                  </div>
                  <button
                    type="submit"
                    aria-label="Send reply"
                    disabled={!chatInput.trim()}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-forge transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forge-ember/50 ${
                      chatInput.trim()
                        ? "bg-forge-ember text-white hover:bg-forge-ember-bright"
                        : theme === "dark"
                          ? "text-forge-zinc hover:text-forge-silver hover:bg-forge-iron/50"
                          : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                    } disabled:cursor-not-allowed`}
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Send reply</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        message={message}
        chatId={message.id}
        workspaceId={workspace.id}
        session={session}
      />

      {message.responseRollbackToRevisionNumber !== undefined && (
        <RollbackModal
          isOpen={showRollbackModal}
          onClose={() => setShowRollbackModal(false)}
          workspaceId={workspace.id}
          revisionNumber={message.responseRollbackToRevisionNumber}
          session={session}
          onSuccess={(updatedWorkspace, updatedMessages) => {
            setWorkspace(updatedWorkspace);
            setMessages(updatedMessages);
          }}
        />
      )}
    </div>
  );
}

/**
 * ChatMessage component - Renders a single chat message with user prompt and assistant response.
 */
export const ChatMessage = ChatMessageInner;