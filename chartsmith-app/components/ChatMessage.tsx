"use client";

import React, { useState, useRef, useEffect, FormEvent, useMemo, useCallback, memo } from "react";
import { useAtom } from "jotai";
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
import { conversionByIdAtom, messageByIdAtom, messagesAtom, renderByIdAtom, workspaceAtom } from "@/atoms/workspace";

// actions
import { cancelMessageAction } from "@/lib/workspace/actions/cancel-message";
import { performFollowupAction } from "@/lib/workspace/actions/perform-followup-action";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";

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
        className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"
        aria-hidden="true"
      />
      <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
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
        return theme === 'dark' ? 'text-green-400' : 'text-green-600';
      case 'call':
        return theme === 'dark' ? 'text-blue-400' : 'text-blue-600';
      case 'partial-call':
        return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'result':
        return 'completed';
      case 'call':
        return 'running';
      case 'partial-call':
        return 'preparing';
      default:
        return state;
    }
  };

  return (
    <div 
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
        theme === 'dark' ? 'bg-dark-border/30' : 'bg-gray-50'
      }`}
      role="status"
      aria-label={`Tool ${tool.toolName}: ${getStateLabel(tool.state)}`}
    >
      <span className="flex-shrink-0" aria-hidden="true">🔧</span>
      <span className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
        {tool.toolName}
      </span>
      <span 
        className={`ml-auto ${getStateColor(tool.state)}`}
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
      className={`relative group rounded-md overflow-hidden my-2 ${
        theme === 'dark' ? 'bg-dark' : 'bg-gray-900'
      }`}
      role="figure"
      aria-label={language ? `${language.toUpperCase()} code block` : 'Code block'}
    >
      {/* Language label */}
      {language && (
        <div 
          className={`px-3 py-1 text-[10px] font-mono ${
            theme === 'dark' ? 'bg-dark-border/50 text-gray-500' : 'bg-gray-800 text-gray-400'
          }`}
          aria-hidden="true"
        >
          {language.toUpperCase()}
        </div>
      )}
      
      {/* Copy button with accessible label and status */}
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
        aria-live="polite"
        className={`absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary/50 ${
          theme === 'dark' 
            ? 'bg-dark-border/60 hover:bg-dark-border text-gray-400 hover:text-gray-200' 
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
        }`}
        title={copied ? "Copied!" : "Copy code"}
      >
        {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
        <span className="sr-only">{copied ? "Copied to clipboard" : "Copy code"}</span>
      </button>
      
      {/* Code content */}
      <pre 
        className={`p-3 overflow-x-auto text-xs font-mono ${
          theme === 'dark' ? 'text-gray-200' : 'text-gray-100'
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

// Streaming indicator component with animated bouncing dots and cursor
function StreamingIndicator({ theme, showCursor = false }: { theme: string; showCursor?: boolean }) {
  if (showCursor) {
    // Show blinking cursor for inline streaming
    return (
      <span 
        className="streaming-cursor" 
        role="status" 
        aria-label="Generating response"
      />
    );
  }
  
  return (
    <span 
      className="inline-flex items-center gap-1 ml-1" 
      role="status" 
      aria-label="Generating response"
    >
      <span 
        className={`inline-block w-1.5 h-1.5 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`}
        style={{ animationDelay: '0ms', animationDuration: '600ms' }}
      />
      <span 
        className={`inline-block w-1.5 h-1.5 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`}
        style={{ animationDelay: '150ms', animationDuration: '600ms' }}
      />
      <span 
        className={`inline-block w-1.5 h-1.5 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`}
        style={{ animationDelay: '300ms', animationDuration: '600ms' }}
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

  const handleApplyChanges = async () => {
    console.log("handleApplyChanges");
  }

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
    <div className="space-y-2" data-testid="chat-message">
      {/* User Message */}
      <div 
        className="px-2 py-1" 
        data-testid="user-message"
        role="group"
        aria-label={`Your message${formattedTime ? ` at ${formattedTime}` : ''}`}
      >
        <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-primary/20" : "bg-primary/10"} rounded-tr-sm w-full`}>
          <div className="flex items-start gap-2">
            <Image
              src={session.user.imageUrl}
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              className="w-6 h-6 rounded-full flex-shrink-0"
            />
            <div className="flex-1">
              {/* Screen reader only user name */}
              <span className="sr-only">{session.user.name} said:</span>
              <div 
                className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-[12px] pt-0.5 ${message.isCanceled ? "opacity-50" : ""}`}
                aria-label={message.isCanceled ? "Message canceled" : undefined}
              >
                {message.prompt}
              </div>
              {!message.isIntentComplete && !message.isCanceled && (
                <div 
                  className="flex items-center gap-2 mt-2 border-t border-primary/20 pt-2"
                  role="status"
                  aria-live="polite"
                >
                  <div 
                    className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"
                    aria-hidden="true"
                  />
                  <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    thinking...
                  </div>
                  <button
                    aria-label="Cancel message generation"
                    className={`ml-auto text-xs px-1.5 py-0.5 rounded border focus:outline-none focus:ring-2 focus:ring-primary/50 ${theme === "dark" ? "border-dark-border text-gray-400 hover:text-gray-200" : "border-gray-300 text-gray-500 hover:text-gray-700"} hover:bg-dark-border/40`}
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
                  className="flex items-center gap-2 mt-2 border-t border-primary/20 pt-2"
                  role="status"
                  aria-live="polite"
                >
                  <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    Message generation canceled
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assistant Message */}
      {(message.response || message.content || message.responsePlanId || message.responseRenderId || message.responseConversionId || message.toolInvocations?.length || (message.isIntentComplete && !message.responsePlanId)) && (
        <div 
          className="px-2 py-1" 
          data-testid="assistant-message"
          role="group"
          aria-label={`ChartSmith response${message.isStreaming ? ', generating' : ''}`}
        >
          <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm w-full`}>
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1 flex items-center justify-between`}>
              <div aria-hidden="true">ChartSmith</div>
              <div className="text-[10px] opacity-70" aria-label={`Revision ${
                message.revisionNumber !== undefined
                  ? message.revisionNumber
                  : message.id
                    ? Array.from(message.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100
                    : "unknown"
              }`}>
                Rev #{
                  // Try to get actual revision number, otherwise use a hash of the message ID to generate a stable pseudo-revision
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
              className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} ${message.isIgnored ? "opacity-50 line-through" : ""} text-[12px] markdown-content`}
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
                <div className="mt-2 text-[9px] border-t border-gray-200 dark:border-dark-border/30 pt-1 flex justify-end">
                  <button
                    aria-label={`Rollback to revision ${message.responseRollbackToRevisionNumber}`}
                    className={`${theme === "dark" ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"} hover:underline flex items-center focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-1`}
                    onClick={() => setShowRollbackModal(true)}
                  >
                    <svg className="w-2 h-2 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
                className="mt-4 flex gap-2 justify-end"
                aria-label="Suggested follow-up actions"
              >
                {message.followupActions.map((action, index) => (
                  <button
                    key={index}
                    aria-label={`Follow-up action: ${action.label}`}
                    className={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      theme === "dark"
                        ? "bg-dark border-dark-border/60 text-gray-300 hover:text-white hover:bg-dark-border/40"
                        : "bg-white border border-gray-300 text-gray-600 hover:text-gray-800 hover:bg-gray-50"
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
              <div className="mt-6 border-t border-dark-border/20">
                <div className={`pt-4 ${message.responsePlanId ? "border-t border-dark-border/10" : ""}`}>
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
                      placeholder="Ask a question or suggest changes..."
                      rows={1}
                      style={{ height: 'auto', minHeight: '34px', maxHeight: '150px' }}
                      aria-describedby={`chat-reply-hint-${messageId}`}
                      className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                        theme === "dark"
                          ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                          : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                      } focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50`}
                    />
                    <div id={`chat-reply-hint-${messageId}`} className="sr-only">
                      Press Enter to send, Shift+Enter for new line
                    </div>
                    <button
                      type="submit"
                      aria-label="Send reply"
                      disabled={!chatInput.trim()}
                      className={`absolute right-2 top-[5px] p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                      } hover:bg-gray-100 dark:hover:bg-dark-border/40 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Send reply</span>
                    </button>
                  </form>
                </div>
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
 * Memoized ChatMessage component to prevent unnecessary re-renders.
 * Only re-renders when messageId, session, or showChatInput changes.
 */
export const ChatMessage = memo(ChatMessageInner, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if these props change
  return (
    prevProps.messageId === nextProps.messageId &&
    prevProps.session?.id === nextProps.session?.id &&
    prevProps.showChatInput === nextProps.showChatInput
    // Note: onContentUpdate is intentionally excluded as it's typically a stable callback
  );
});