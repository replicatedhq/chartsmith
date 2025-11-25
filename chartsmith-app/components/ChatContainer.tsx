/**
 * ChatContainer - Main chat interface component for ChartSmith.
 * 
 * This component provides the primary chat UI for interacting with the AI assistant.
 * It uses a custom streaming hook (useStreamingChat) instead of AI SDK's useChat
 * for better control over streaming, cancellation, and workspace integration.
 * 
 * ## Features
 * 
 * - **Streaming Responses**: Real-time display of AI responses as they're generated
 * - **Stop Button**: Cancel in-progress requests (red square button)
 * - **Workspace Context**: Automatically sends chart files to AI for context
 * - **Role Selector**: Choose perspective (Auto/Developer/Operator)
 * - **New Chart Flow**: Special UI for creating new charts (revision 0)
 * 
 * ## Architecture
 * 
 * ```
 * ChatContainer
 *   ├── useStreamingChat (custom hook)
 *   │   └── /api/chat (AI SDK + Anthropic)
 *   ├── messagesAtom (Jotai) ← synced from streamMessages
 *   └── ChatMessage (renders each message)
 * ```
 * 
 * ## Context Injection
 * 
 * The component automatically extracts chart context from the workspace atom
 * and sends it with each request, allowing the AI to reference and modify files.
 * 
 * ## Accessibility (WCAG 2.1 AA)
 * 
 * - Semantic HTML with proper landmark regions (main, complementary)
 * - role="log" for message list with aria-live="polite"
 * - Screen reader announcements for new messages and state changes
 * - Keyboard navigation (Enter to send, Escape to close dropdowns)
 * - Visible focus indicators
 * - sr-only labels for icon-only buttons
 * 
 * @module components/ChatContainer
 */

"use client";
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { Send, Loader2, Users, Code, User, Sparkles, Square, AlertCircle, RefreshCw, Clock } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartContent } from "./NewChartContent";
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { Message } from "./types";
import { ConversationManager } from "./ConversationManager";

/**
 * Animated typing indicator with three bouncing dots.
 * Memoized to prevent unnecessary re-renders during streaming.
 */
const TypingIndicator = memo(function TypingIndicator({ theme }: { theme: string }) {
  return (
    <div className="flex items-center gap-1.5" role="status" aria-label="ChartSmith is typing">
      <span 
        className={`w-2 h-2 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`} 
        style={{ animationDelay: '0ms', animationDuration: '600ms' }} 
      />
      <span 
        className={`w-2 h-2 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`} 
        style={{ animationDelay: '150ms', animationDuration: '600ms' }} 
      />
      <span 
        className={`w-2 h-2 rounded-full animate-bounce ${
          theme === 'dark' ? 'bg-primary/70' : 'bg-primary/60'
        }`} 
        style={{ animationDelay: '300ms', animationDuration: '600ms' }} 
      />
    </div>
  );
});

/**
 * Loading state component shown during AI response generation.
 * Memoized to prevent unnecessary re-renders.
 * 
 * Accessibility:
 * - role="status" announces to screen readers
 * - aria-live="polite" for non-intrusive announcements
 * - Clear visual and text indicators
 */
const LoadingState = memo(function LoadingState({ 
  theme, 
  isLongRunning,
  onStop 
}: { 
  theme: string; 
  isLongRunning: boolean;
  onStop: () => void;
}) {
  return (
    <div 
      className={`mx-2 my-2 p-3 rounded-lg ${
        theme === 'dark' ? 'bg-dark-border/30' : 'bg-gray-50'
      }`}
      role="status"
      aria-live="polite"
      aria-label={isLongRunning ? "ChartSmith is thinking, taking longer than expected" : "ChartSmith is thinking"}
    >
      <div className="flex items-center gap-3">
        <div 
          className={`p-2 rounded-full ${
            theme === 'dark' ? 'bg-primary/20' : 'bg-primary/10'
          }`}
          aria-hidden="true"
        >
          <TypingIndicator theme={theme} />
        </div>
        <div className="flex-1">
          <span className={`text-sm font-medium ${
            theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
          }`}>
            ChartSmith is thinking...
          </span>
          {isLongRunning && (
            <div 
              className={`flex items-center gap-1.5 mt-1 text-xs ${
                theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
              }`}
              role="alert"
            >
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>This is taking longer than expected...</span>
            </div>
          )}
        </div>
        <button
          onClick={onStop}
          aria-label="Stop generating response"
          className={`px-3 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
            theme === 'dark'
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300'
              : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
          }`}
          title="Stop generating"
        >
          <span className="flex items-center gap-1.5">
            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
            Stop
          </span>
        </button>
      </div>
    </div>
  );
});

/**
 * Get user-friendly error message based on error type.
 */
function getErrorMessage(error: Error): { title: string; description: string; canRetry: boolean } {
  const message = error.message.toLowerCase();
  
  if (message.includes('rate limit') || message.includes('429')) {
    return {
      title: 'Rate limit exceeded',
      description: 'Too many requests. Please wait a moment before trying again.',
      canRetry: true,
    };
  }
  
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return {
      title: 'Connection error',
      description: 'Unable to connect to the server. Please check your internet connection.',
      canRetry: true,
    };
  }
  
  if (message.includes('timeout') || message.includes('504')) {
    return {
      title: 'Request timeout',
      description: 'The request took too long to complete. Please try again.',
      canRetry: true,
    };
  }
  
  if (message.includes('401') || message.includes('unauthorized')) {
    return {
      title: 'Authentication error',
      description: 'Your session may have expired. Please refresh the page.',
      canRetry: false,
    };
  }
  
  if (message.includes('500') || message.includes('server error')) {
    return {
      title: 'Server error',
      description: 'Something went wrong on our end. Please try again later.',
      canRetry: true,
    };
  }
  
  return {
    title: 'Something went wrong',
    description: error.message || 'An unexpected error occurred.',
    canRetry: true,
  };
}

/**
 * Error state component with retry functionality.
 * Memoized to prevent unnecessary re-renders.
 * 
 * Accessibility:
 * - role="alert" for immediate announcement
 * - aria-live="assertive" for urgent errors
 * - Proper heading hierarchy
 * - Focus management for interactive elements
 */
const ErrorState = memo(function ErrorState({ 
  error, 
  theme, 
  onRetry,
  onDismiss 
}: { 
  error: Error; 
  theme: string; 
  onRetry?: () => void;
  onDismiss: () => void;
}) {
  const { title, description, canRetry } = getErrorMessage(error);
  
  return (
    <div 
      className={`mx-2 my-2 p-4 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-red-950/30 border-red-900/50' 
          : 'bg-red-50 border-red-200'
      }`}
      role="alert"
      aria-live="assertive"
      aria-describedby="error-description"
    >
      <div className="flex items-start gap-3">
        <div 
          className={`p-2 rounded-full flex-shrink-0 ${
            theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
          }`}
          aria-hidden="true"
        >
          <AlertCircle className={`w-4 h-4 ${
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${
            theme === 'dark' ? 'text-red-300' : 'text-red-800'
          }`}>
            {title}
          </h4>
          <p 
            id="error-description"
            className={`mt-1 text-xs ${
              theme === 'dark' ? 'text-red-400/80' : 'text-red-600'
            }`}
          >
            {description}
          </p>
          <div className="flex items-center gap-2 mt-3" role="group" aria-label="Error actions">
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                aria-label="Try again"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                  theme === 'dark'
                    ? 'bg-red-900/50 text-red-300 hover:bg-red-900/70 hover:text-red-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800'
                }`}
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                Try again
              </button>
            )}
            <button
              onClick={onDismiss}
              aria-label="Dismiss error"
              className={`px-3 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/50 ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-dark-border/40'
                  : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Chart context structure sent to the API.
 * Contains chart name and all files with their paths and content.
 */
interface ChartContext {
  /** Name of the Helm chart */
  name: string;
  /** Array of files in the chart */
  files: Array<{
    /** File path relative to chart root */
    path: string;
    /** File content */
    content: string;
  }>;
}

interface ChatContainerProps {
  /** Current user session */
  session: Session;
}

/**
 * Main chat container component.
 * 
 * Renders the chat interface with message history, input field, and controls.
 * Handles streaming responses from the AI and syncs with Jotai state.
 * 
 * @param props - Component props
 * @param props.session - Current user session for authentication
 */
export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom);
  const [messages, setMessages] = useAtom(messagesAtom);

  /**
   * Build chart context from workspace.
   * Memoized to avoid unnecessary re-renders and API calls.
   * This context is sent with each chat request so the AI knows what files exist.
   */
  const chartContext = useMemo<ChartContext[]>(() => {
    if (!workspace?.charts) return [];
    
    return workspace.charts.map(chart => ({
      name: chart.name,
      files: chart.files.map(file => ({
        path: file.filePath,
        content: file.content,
      })),
    }));
  }, [workspace?.charts]);

  /**
   * Build loose files context (files not in any chart).
   * These are also sent to the AI for context.
   */
  const looseFilesContext = useMemo(() => {
    if (!workspace?.files) return [];
    
    return workspace.files.map(file => ({
      path: file.filePath,
      content: file.content,
    }));
  }, [workspace?.files]);

  /**
   * Custom streaming chat hook.
   * Replaces AI SDK's useChat with our custom implementation that supports:
   * - Stop button (via AbortController)
   * - Workspace context injection
   * - SSE streaming format parsing
   */
  const {
    messages: streamMessages,
    input,
    handleInputChange,
    handleSubmit: streamHandleSubmit,
    isLoading,
    error,
    stop
  } = useStreamingChat({
    api: '/api/chat',
    body: {
      workspaceId: workspace?.id,
      workspaceName: workspace?.name,
      currentRevision: workspace?.currentRevisionNumber,
      charts: chartContext,
      looseFiles: looseFilesContext,
    },
    onError: (err) => {
      console.error("Chat error:", err);
    }
  });

  /**
   * Sync streaming messages to Jotai messagesAtom.
   * This is necessary because ChatMessage component reads from messagesAtom,
   * but useStreamingChat maintains its own message state.
   * 
   * The sync converts from the hook's format ({ role, content }) to the
   * workspace format ({ prompt, response, isComplete, etc. })
   */
  useEffect(() => {
    if (!streamMessages.length) return;

    const newWorkspaceMessages: Message[] = [];

    // Process messages in pairs (User + Assistant)
    for (let i = 0; i < streamMessages.length; i++) {
      const msg = streamMessages[i];

      if (msg.role === 'user') {
        const nextMsg = streamMessages[i + 1];
        const hasResponse = nextMsg && nextMsg.role === 'assistant';
        const isAssistantStreaming = hasResponse && isLoading && i === streamMessages.length - 2;

        const workspaceMsg: Message = {
          id: msg.id,
          prompt: msg.content,
          response: hasResponse ? nextMsg.content : undefined,
          isComplete: !isAssistantStreaming,
          createdAt: msg.createdAt || new Date(),
          workspaceId: workspace?.id,
          isIntentComplete: hasResponse && !isAssistantStreaming ? true : false,
          isStreaming: isAssistantStreaming,
        };

        newWorkspaceMessages.push(workspaceMsg);

        if (hasResponse) i++; // Skip next message as it's consumed
      }
    }

    // Update only if different
    const isDifferent =
        newWorkspaceMessages.length !== messages.length ||
        (newWorkspaceMessages.length > 0 && messages.length > 0 &&
         newWorkspaceMessages[newWorkspaceMessages.length - 1].id !== messages[messages.length - 1].id) ||
        (newWorkspaceMessages.length > 0 && messages.length > 0 &&
         newWorkspaceMessages[newWorkspaceMessages.length - 1].response !== messages[messages.length - 1].response);

    if (isDifferent) {
       setMessages(newWorkspaceMessages);
    }
  }, [streamMessages, workspace?.id, setMessages, messages, isLoading]);

  const [selectedRole, setSelectedRole] = useState<"auto" | "developer" | "operator">("auto");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [showError, setShowError] = useState(true);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [isLongRunning, setIsLongRunning] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(undefined);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Accessibility: Track previous message count for announcements
  const prevMessageCountRef = useRef<number>(0);

  // Track loading duration for long-running request feedback
  useEffect(() => {
    if (isLoading) {
      setLoadingStartTime(Date.now());
      setIsLongRunning(false);
      
      // Show "taking longer than expected" after 10 seconds
      const timer = setTimeout(() => {
        setIsLongRunning(true);
      }, 10000);
      
      return () => clearTimeout(timer);
    } else {
      setLoadingStartTime(null);
      setIsLongRunning(false);
    }
  }, [isLoading]);

  // Reset error visibility when a new error occurs
  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  // Close role menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setIsRoleMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Accessibility: Close role menu on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isRoleMenuOpen) {
        setIsRoleMenuOpen(false);
        // Return focus to the role button
        const roleButton = roleMenuRef.current?.querySelector('button');
        roleButton?.focus();
  }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRoleMenuOpen]);

  // Accessibility: Announce new messages to screen readers
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      // The aria-live region will automatically announce new content
      // We just need to track the count for comparison
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  /**
   * Handle form submission - memoized to prevent unnecessary re-renders.
   */
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (!session || !workspace) return;

    // Call streaming chat's handleSubmit
    streamHandleSubmit(e);
  }, [input, isLoading, session, workspace, streamHandleSubmit]);

  /**
   * Get human-readable label for role - memoized for performance.
   */
  const getRoleLabel = useCallback((role: "auto" | "developer" | "operator"): string => {
    switch (role) {
      case "auto":
        return "Auto-detect";
      case "developer":
        return "Chart Developer";
      case "operator":
        return "End User";
      default:
        return "Auto-detect";
    }
  }, []);

  /**
   * Handle keyboard events in textarea - memoized.
   * Supports Enter to send, Escape to blur.
   */
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    } else if (e.key === 'Escape') {
      // Blur the textarea on Escape
      e.currentTarget.blur();
    }
  }, [isLoading, handleSubmit]);

  /**
   * Toggle role menu - memoized.
   */
  const toggleRoleMenu = useCallback(() => {
    setIsRoleMenuOpen(prev => !prev);
  }, []);

  /**
   * Handle role selection - memoized.
   */
  const handleRoleSelect = useCallback((role: "auto" | "developer" | "operator") => {
    setSelectedRole(role);
    setIsRoleMenuOpen(false);
  }, []);

  /**
   * Handle error dismiss - memoized.
   */
  const handleErrorDismiss = useCallback(() => {
    setShowError(false);
  }, []);

  /**
   * Handle error retry - memoized.
   */
  const handleErrorRetry = useCallback(() => {
    setShowError(false);
    // The user can type a new message to retry
  }, []);

  /**
   * Callback for content updates in ChatMessage - stable reference.
   */
  const handleContentUpdate = useCallback(() => {
    // ScrollingContent handles scrolling
  }, []);

  /**
   * Handle loading a saved conversation.
   */
  const handleLoadConversation = useCallback((loadedMessages: Message[]) => {
    setMessages(loadedMessages);
    // Clear the streaming hook's messages to prevent sync issues
    // The loaded messages will be shown from the messagesAtom
  }, [setMessages]);

  /**
   * Handle clearing the current chat.
   */
  const handleClearChat = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(undefined);
  }, [setMessages]);

  /**
   * Handle when a conversation is saved.
   */
  const handleConversationSaved = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);
    
  if (!messages || !workspace) {
    return null;
  }

  // Handle new chart flow
  if (workspace?.currentRevisionNumber === 0) {
    return <NewChartContent
      session={session}
      chatInput={input}
      setChatInput={(value) => {
        // NewChartContent expects a setState function
        // We need to create a synthetic event for handleInputChange
        const syntheticEvent = {
          target: { value }
        } as React.ChangeEvent<HTMLInputElement>;
        handleInputChange(syntheticEvent);
      }}
      handleSubmitChat={handleSubmit}
    />
  }

  return (
    <main 
      className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}
      aria-label="Chat interface"
    >
      {/* Chat header with conversation manager */}
      <header 
        className={`flex items-center justify-between px-3 py-2 border-b flex-shrink-0 ${
          theme === "dark" ? "border-dark-border" : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <h1 className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Chat
          </h1>
          {currentConversationId && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              theme === "dark" ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
            }`}>
              Saved
            </span>
          )}
        </div>
        <ConversationManager
          messages={messages}
          onLoadConversation={handleLoadConversation}
          onClearChat={handleClearChat}
          currentConversationId={currentConversationId}
          onConversationSaved={handleConversationSaved}
        />
      </header>

      {/* Screen reader only announcement region for new messages */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="false"
      >
        {messages.length > 0 && messages[messages.length - 1].response && (
          <span>New response from ChartSmith</span>
        )}
      </div>

      <div className="flex-1 h-full overflow-hidden">
        <ScrollingContent forceScroll={true}>
          {/* Message list with role="log" for accessibility */}
          <div 
            className={workspace?.currentRevisionNumber === 0 ? "" : "pb-32"}
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.length === 0 && (
              <div 
                className={`text-center py-8 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                role="status"
              >
                Start a conversation by typing a message below
              </div>
            )}
            {messages.map((item, index) => {
              // Check if this is a recently added message for animation
              const isNewMessage = index >= messages.length - 2;
              
              return (
                <article 
                  key={item.id}
                  aria-label={`Message ${index + 1}`}
                  aria-posinset={index + 1}
                  aria-setsize={messages.length}
                  className={isNewMessage ? 'message-animate-in' : ''}
                  style={{ 
                    animationDelay: isNewMessage ? `${(index - (messages.length - 2)) * 100}ms` : '0ms'
                  }}
                >
                  <ChatMessage
                  messageId={item.id}
                  session={session}
                    onContentUpdate={handleContentUpdate}
                  />
                </article>
              );
            })}
            
            {/* Loading state with aria-busy */}
            <div aria-busy={isLoading} aria-live="polite">
              {isLoading && (
                <LoadingState 
                  theme={theme} 
                  isLongRunning={isLongRunning}
                  onStop={stop}
                />
              )}
              </div>
            
            {/* Error state */}
            {error && showError && (
              <ErrorState 
                error={error} 
                theme={theme}
                onRetry={handleErrorRetry}
                onDismiss={handleErrorDismiss}
              />
            )}
          </div>
        </ScrollingContent>
      </div>
      {/* Chat input form - complementary region */}
      <aside 
        className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}
        aria-label="Message input"
      >
        <form onSubmit={handleSubmit} className="p-3 relative" role="form" aria-label="Send a message">
          <label htmlFor="chat-input" className="sr-only">
            Type your message
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            aria-describedby="chat-input-hint"
            aria-invalid={false}
            className={`w-full px-3 py-1.5 pr-24 text-sm rounded-md border resize-none overflow-hidden ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50`}
          />
          <div id="chat-input-hint" className="sr-only">
            Press Enter to send, Shift+Enter for new line, Escape to unfocus
          </div>
          
          <div className="absolute right-4 top-[18px] flex gap-2">
            {/* Role selector button */}
            <div ref={roleMenuRef} className="relative">
              <button
                type="button"
                onClick={toggleRoleMenu}
                aria-expanded={isRoleMenuOpen}
                aria-haspopup="listbox"
                aria-label={`Select perspective, current: ${getRoleLabel(selectedRole)}`}
                className={`p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                } ${selectedRole !== "auto" ? "bg-blue-500/10" : ""}`}
                title={`Perspective: ${getRoleLabel(selectedRole)}`}
              >
                {selectedRole === "auto" && <Sparkles className="w-4 h-4" aria-hidden="true" />}
                {selectedRole === "developer" && <Code className="w-4 h-4" aria-hidden="true" />}
                {selectedRole === "operator" && <User className="w-4 h-4" aria-hidden="true" />}
                <span className="sr-only">Select perspective</span>
              </button>
              
              {/* Role selector dropdown */}
              {isRoleMenuOpen && (
                <div 
                  role="listbox"
                  aria-label="Select perspective"
                  aria-activedescendant={`role-option-${selectedRole}`}
                  className={`absolute bottom-full right-0 mb-1 w-56 rounded-lg shadow-lg border py-1 z-50 ${
                    theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
                  }`}
                >
                  <div 
                    className={`px-3 py-2 text-xs font-medium ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                    id="role-selector-label"
                  >
                    Ask questions from...
                  </div>
                  {(["auto", "developer", "operator"] as const).map((role) => (
                    <button
                      key={role}
                      id={`role-option-${role}`}
                      type="button"
                      role="option"
                      aria-selected={selectedRole === role}
                      onClick={() => handleRoleSelect(role)}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50 ${
                        selectedRole === role
                          ? theme === "dark" 
                            ? "bg-dark-border/60 text-white" 
                            : "bg-gray-100 text-gray-900"
                          : theme === "dark"
                            ? "text-gray-300 hover:bg-dark-border/40 hover:text-white"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {role === "auto" && <Sparkles className="w-4 h-4" aria-hidden="true" />}
                        {role === "developer" && <Code className="w-4 h-4" aria-hidden="true" />}
                        {role === "operator" && <User className="w-4 h-4" aria-hidden="true" />}
                        <span>{getRoleLabel(role)}</span>
                      </div>
                      {selectedRole === role && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Send/Stop button */}
            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating response"
                className={`p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                  theme === "dark"
                    ? "text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    : "text-red-500 hover:text-red-600 hover:bg-red-100"
                }`}
                title="Stop generating"
              >
                <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                <span className="sr-only">Stop generating</span>
              </button>
            ) : (
            <button
              type="submit"
                disabled={!input.trim()}
                aria-label={input.trim() ? "Send message" : "Send message (disabled - type a message first)"}
                aria-disabled={!input.trim()}
                className={`p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  !input.trim()
                  ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
                title="Send message"
            >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Send message</span>
            </button>
            )}
          </div>
        </form>
      </aside>
    </main>
  );
}
