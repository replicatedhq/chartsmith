"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Users, Code, User, Sparkles, Square } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { NewChartContent } from "./NewChartContent";

// PR2.0: Import adapter hooks for AI SDK integration
import { useAISDKChatAdapter, type ChatPersona } from "@/hooks/useAISDKChatAdapter";
import { useLegacyChat } from "@/hooks/useLegacyChat";

interface ChatContainerProps {
  session: Session;
}

// PR2.0: AI SDK is now the default chat transport
// Set NEXT_PUBLIC_USE_AI_SDK_CHAT=false to fall back to legacy Go worker path
const USE_AI_SDK_CHAT = process.env.NEXT_PUBLIC_USE_AI_SDK_CHAT !== 'false';

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom)
  const [messages, setMessages] = useAtom(messagesAtom)
  const [isRendering] = useAtom(isRenderingAtom)
  const [chatInput, setChatInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<ChatPersona>("auto");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  
  // PR2.0: Conditional chat transport based on feature flag
  // Legacy path: Go worker processes via PostgreSQL queue + Centrifugo
  // AI SDK path: Direct streaming via /api/chat endpoint
  const legacyChat = useLegacyChat(session);
  const aiSDKChat = useAISDKChatAdapter(
    workspace?.id ?? '',
    workspace?.currentRevisionNumber ?? 0,
    session,
    messages // Pass current messages as initial for merging
  );
  
  // Select chat transport based on feature flag
  const chatState = USE_AI_SDK_CHAT ? aiSDKChat : legacyChat;
  
  // Determine if chat is busy (for UI disabling)
  const isBusy = chatState.isStreaming || chatState.isThinking;

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

  if (!messages || !workspace) {
    return null;
  }

  // PR2.0: Unified submit handler using adapter
  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isBusy) return; // Don't submit if busy
    if (!session || !workspace) return;

    // Use adapter's sendMessage which handles both legacy and AI SDK paths
    // Persona is passed for prompt selection in AI SDK mode
    await chatState.sendMessage(chatInput.trim(), selectedRole);
    setChatInput("");
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

  // PR2.0: Only show NewChartContent for legacy mode at revision 0
  // AI SDK mode shows the full workspace view with sidebar, so skip NewChartContent
  if (!USE_AI_SDK_CHAT && workspace?.currentRevisionNumber === 0) {
    // For NewChartContent, create a simpler version of handleSubmitChat that doesn't use role selector
    // Legacy mode uses adapter pattern
    const handleNewChartSubmitChat = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isBusy) return;
      if (!session || !workspace) return;

      // Always use AUTO for new chart creation
      await chatState.sendMessage(chatInput.trim(), "auto");
      setChatInput("");
    };
    
    return <NewChartContent
      session={session}
      chatInput={chatInput}
      setChatInput={setChatInput}
      handleSubmitChat={handleNewChartSubmitChat}
      messages={messages}
      isStreaming={chatState.isStreaming}
      isThinking={chatState.isThinking}
    />
  }

  // PR2.0: Use chatState.messages for AI SDK mode, messages atom for legacy
  // This ensures we display the right messages based on transport
  const displayMessages = USE_AI_SDK_CHAT ? chatState.messages : messages;

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className={workspace?.currentRevisionNumber === 0 ? "" : "pb-32"}>
            {displayMessages.map((item, index) => (
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
            
            {/* PR2.0: Thinking indicator for AI SDK mode */}
            {USE_AI_SDK_CHAT && chatState.isThinking && (
              <div className={`px-4 py-3 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                  <button
                    type="button"
                    onClick={() => chatState.cancel()}
                    className={`ml-auto text-xs px-2 py-1 rounded border ${
                      theme === "dark"
                        ? "border-dark-border text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                        : "border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* PR2.0: Streaming indicator for AI SDK mode */}
            {USE_AI_SDK_CHAT && chatState.isStreaming && !chatState.isThinking && (
              <div className={`px-4 py-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Generating response...</span>
                  <button
                    type="button"
                    onClick={() => chatState.cancel()}
                    className={`ml-auto text-xs px-2 py-1 rounded border flex items-center gap-1 ${
                      theme === "dark"
                        ? "border-dark-border text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                        : "border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Square className="w-3 h-3" />
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        </ScrollingContent>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        <form onSubmit={handleSubmitChat} className="p-3 relative">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isBusy) {
                  handleSubmitChat(e);
                }
              }
            }}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-24 text-sm rounded-md border resize-none overflow-hidden ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
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
                } ${selectedRole !== "auto" ? "bg-blue-500/10" : ""}`}
                title={`Perspective: ${getRoleLabel(selectedRole)}`}
              >
                {selectedRole === "auto" && <Sparkles className="w-4 h-4" />}
                {selectedRole === "developer" && <Code className="w-4 h-4" />}
                {selectedRole === "operator" && <User className="w-4 h-4" />}
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
                        setSelectedRole(role);
                        setIsRoleMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
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
                        {role === "auto" && <Sparkles className="w-4 h-4" />}
                        {role === "developer" && <Code className="w-4 h-4" />}
                        {role === "operator" && <User className="w-4 h-4" />}
                        <span>{getRoleLabel(role)}</span>
                      </div>
                      {selectedRole === role && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
              disabled={isBusy}
              className={`p-1.5 rounded-full ${
                isBusy
                  ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
