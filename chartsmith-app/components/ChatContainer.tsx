/**
 * @fileoverview Chat container component that manages chat UI and state.
 * 
 * This component uses the Vercel AI SDK's useChat hook (via useAIChat wrapper)
 * for all chat functionality. It handles:
 * - Message display and input
 * - Role selection (auto/developer/operator)
 * - Message persistence via useChatPersistence hook
 * - Integration with workspace state (Jotai atoms)
 * 
 * Chat messages flow through the AI SDK HTTP SSE protocol, while other
 * events (plans, renders, artifacts) still use Centrifugo WebSocket.
 * 
 * @see useAIChat - Main chat hook wrapper
 * @see useChatPersistence - Message persistence hook
 */

"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Users, Code, User, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { NewChartContent } from "./NewChartContent";
import { useAIChat } from "@/hooks/useAIChat";
import { useChatPersistence } from "@/hooks/useChatPersistence";
import { CoreMessage } from 'ai';
import { aiMessageToMessage } from "@/lib/types/chat";

interface ChatContainerProps {
  session: Session;
}

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom)
  const [messages, setMessages] = useAtom(messagesAtom)
  const [isRendering] = useAtom(isRenderingAtom)
  const [chatInput, setChatInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<"auto" | "developer" | "operator">("auto");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  
  // Use persistence hook to load chat history and save messages to database
  const persistence = workspace ? useChatPersistence({
    workspaceId: workspace.id,
    enabled: true,
  }) : null;

  // Convert persistence messages (AI SDK CoreMessage format) to Chartsmith Message format for useAIChat
  // AI SDK uses separate user/assistant messages, but we combine them into pairs
  const persistenceMessages = React.useMemo(() => {
    if (!persistence?.initialMessages || persistence.isLoadingHistory) {
      return messages;
    }
    
    // Convert CoreMessage[] to Message[] by pairing user/assistant messages
    const convertedMessages: Message[] = [];
    let currentUserMessage: Message | null = null;
    
    for (const msg of persistence.initialMessages) {
      const metadata = {
        workspaceId: workspace.id,
        userId: session.user.id,
        createdAt: (msg as any).createdAt ? new Date((msg as any).createdAt) : new Date(),
      };
      
      if (msg.role === 'user') {
        // Save previous user message if exists
        if (currentUserMessage) {
          convertedMessages.push(currentUserMessage);
        }
        currentUserMessage = aiMessageToMessage(msg, metadata);
      } else if (msg.role === 'assistant' && currentUserMessage) {
        // Merge assistant response with user message
        const assistantMsg = aiMessageToMessage(msg, metadata);
        currentUserMessage.response = assistantMsg.response;
        currentUserMessage.isComplete = true;
        convertedMessages.push(currentUserMessage);
        currentUserMessage = null;
      }
    }
    
    // Add last user message if exists (no response yet)
    if (currentUserMessage) {
      convertedMessages.push(currentUserMessage);
    }
    
    return convertedMessages.length > 0 ? convertedMessages : messages;
  }, [persistence?.initialMessages, persistence?.isLoadingHistory, messages, workspace?.id, session.user.id]);

  // Use AI SDK chat hook (wraps useChat from @ai-sdk/react) with persistence integration
  // This hook manages all chat state and streams messages via HTTP SSE
  const aiChatHook = workspace ? useAIChat({
    workspaceId: workspace.id,
    session,
    initialMessages: persistenceMessages,
    onMessageComplete: persistence ? async (userMsg, assistantMsg) => {
      // When message completes, convert back to AI SDK format and persist to database
      // Convert Message format to CoreMessage for persistence service
      const userCoreMsg: CoreMessage = {
        role: 'user',
        content: userMsg.prompt || '',
      } as CoreMessage;
      const assistantCoreMsg: CoreMessage = {
        role: 'assistant',
        content: assistantMsg.response || '',
      } as CoreMessage;
      await persistence.saveMessage(userCoreMsg, assistantCoreMsg);
    } : undefined,
  }) : null;
  
  // Use hook's state (AI SDK manages input, loading, and role selection)
  // Fallback to local state if hook is not available (shouldn't happen in normal flow)
  const effectiveChatInput = aiChatHook ? aiChatHook.input : chatInput;
  const effectiveIsRendering = aiChatHook ? aiChatHook.isLoading : isRendering;
  const effectiveSelectedRole = aiChatHook ? aiChatHook.selectedRole : selectedRole;
  const effectiveSetSelectedRole = aiChatHook ? aiChatHook.setSelectedRole : setSelectedRole;
  
  // No need for refs as ScrollingContent manages its own scrolling

  // Close the role menu when clicking outside
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

  // Show loading state while history loads
  if (persistence?.isLoadingHistory) {
    return (
      <div className={`h-[calc(100vh-3.5rem)] border-r flex items-center justify-center ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
        <span className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Loading chat history...
        </span>
      </div>
    );
  }

  if (!messages || !workspace) {
    return null;
  }

  const handleSubmitChat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Use hook's handler
    if (aiChatHook) {
      aiChatHook.handleSubmit(e);
      return;
    }
  };
  
  const getRoleLabel = (role: "auto" | "developer" | "operator"): string => {
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
  };

  // ScrollingContent will now handle all the scrolling behavior

  if (workspace?.currentRevisionNumber === 0) {
    // For NewChartContent, create a simpler version of handleSubmitChat that doesn't use role selector
    const handleNewChartSubmitChat = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      
      // Use hook's handler (role is always "auto" for new charts)
      if (aiChatHook) {
        // Ensure role is set to auto
        if (aiChatHook.selectedRole !== "auto") {
          aiChatHook.setSelectedRole("auto");
        }
        aiChatHook.handleSubmit(e);
        return;
      }
    };
    
    return <NewChartContent
      session={session}
      chatInput={effectiveChatInput}
      setChatInput={aiChatHook ? (value: string) => {
        // Update hook's input via synthetic event
        const syntheticEvent = {
          target: { value },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        aiChatHook.handleInputChange(syntheticEvent);
      } : setChatInput}
      handleSubmitChat={handleNewChartSubmitChat}
    />
  }

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className={workspace?.currentRevisionNumber === 0 ? "" : "pb-32"}>
            {messages.map((item, index) => (
              <div key={item.id}>
                <ChatMessage
                  key={item.id}
                  messageId={item.id}
                  session={session}
                  onContentUpdate={() => {
                    // No need to update state - ScrollingContent will handle scrolling
                  }}
                />
              </div>
            ))}
          </div>
        </ScrollingContent>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        <form onSubmit={handleSubmitChat} className="p-3 relative">
          <textarea
            value={effectiveChatInput}
            onChange={(e) => {
              if (aiChatHook) {
                aiChatHook.handleInputChange(e);
              } else {
                setChatInput(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!effectiveIsRendering) {
                  handleSubmitChat(e);
                }
              }
            }}
            disabled={effectiveIsRendering}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-24 text-sm rounded-md border resize-none overflow-hidden ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 ${
              effectiveIsRendering ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
          <div className="absolute right-4 top-[18px] flex gap-2">
            {/* Role selector button */}
            <div ref={roleMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className={`p-1.5 rounded-full ${
                  theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                } ${effectiveSelectedRole !== "auto" ? "bg-blue-500/10" : ""}`}
                title={`Perspective: ${getRoleLabel(effectiveSelectedRole)}`}
              >
                {effectiveSelectedRole === "auto" && <Sparkles className="w-4 h-4" />}
                {effectiveSelectedRole === "developer" && <Code className="w-4 h-4" />}
                {effectiveSelectedRole === "operator" && <User className="w-4 h-4" />}
              </button>
              
              {/* Role selector dropdown */}
              {isRoleMenuOpen && (
                <div 
                  className={`absolute bottom-full right-0 mb-1 w-56 rounded-lg shadow-lg border py-1 z-50 ${
                    theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
                  }`}
                >
                  <div className={`px-3 py-2 text-xs font-medium ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Ask questions from...
                  </div>
                  {(["auto", "developer", "operator"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        effectiveSetSelectedRole(role);
                        setIsRoleMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                        effectiveSelectedRole === role
                          ? theme === "dark" 
                            ? "bg-dark-border/60 text-white" 
                            : "bg-gray-100 text-gray-900"
                          : theme === "dark"
                            ? "text-gray-300 hover:bg-dark-border/40 hover:text-white"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {role === "auto" && <Sparkles className="w-4 h-4" />}
                        {role === "developer" && <Code className="w-4 h-4" />}
                        {role === "operator" && <User className="w-4 h-4" />}
                        <span>{getRoleLabel(role)}</span>
                      </div>
                      {effectiveSelectedRole === role && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Error display */}
            {aiChatHook?.error && (
              <div className="absolute bottom-full right-0 mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500 max-w-xs">
                Error: {aiChatHook.error.message}
              </div>
            )}
            
            {/* Send button */}
            <button
              type="submit"
              disabled={effectiveIsRendering}
              className={`p-1.5 rounded-full ${
                effectiveIsRendering
                  ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {effectiveIsRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
