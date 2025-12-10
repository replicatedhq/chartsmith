"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Users, Code, User, Sparkles, StopCircle } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { NewChartContent } from "./NewChartContent";
import { useAIChat, ChatMessage as AIChatMessage } from "@/hooks/useAIChat";
import { AIMessageParts } from "./AIMessageParts";

interface ChatContainerProps {
  session: Session;
}

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom)
  const [messages] = useAtom(messagesAtom)
  const [isRendering] = useAtom(isRenderingAtom)
  const [selectedRole, setSelectedRole] = useState<"auto" | "developer" | "operator">("auto");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Build context from workspace files for AI
  const buildContext = () => {
    if (!workspace?.charts?.length) return undefined;
    const chartFiles = workspace.charts.flatMap(chart =>
      chart.files?.map(f => `--- ${f.filePath} ---\n${f.content}`).join('\n\n') || ''
    );
    return chartFiles.length > 0 ? `Current Helm chart files:\n${chartFiles}` : undefined;
  };

  // Use Vercel AI SDK hook for chat
  const {
    messages: aiMessages,
    sendMessage,
    input: chatInput,
    setInput: setChatInput,
    handleSubmit: handleAISubmit,
    isLoading: isAILoading,
    status: aiStatus,
    stop: stopGeneration,
    error: aiError,
  } = useAIChat({
    workspaceId: workspace?.id,
    context: buildContext(),
    onFinish: (message) => {
      console.log('[ChatContainer] AI message finished:', message.id);
    },
    onError: (error) => {
      console.error('[ChatContainer] AI error:', error);
    },
  });

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

  if (!workspace) {
    return null;
  }

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(chatInput ?? '').trim() || isRendering || isAILoading) return;
    // Call sendMessage directly instead of handleAISubmit to avoid type issues
    sendMessage(chatInput);
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

  // Helper to render AI messages with streaming support
  const renderAIMessage = (msg: AIChatMessage) => {
    const isUser = msg.role === 'user';
    return (
      <div key={msg.id} className="px-2 py-1">
        <div
          className={`p-3 rounded-lg ${
            isUser
              ? theme === 'dark'
                ? 'bg-primary/20 rounded-tr-sm'
                : 'bg-primary/10 rounded-tr-sm'
              : theme === 'dark'
              ? 'bg-dark-border/40 rounded-tl-sm'
              : 'bg-gray-100 rounded-tl-sm'
          } w-full`}
        >
          <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
            {isUser ? 'You' : 'ChartSmith AI'}
          </div>
          {isUser ? (
            <div className={`text-[12px] ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
              {msg.content}
            </div>
          ) : (
            <AIMessageParts content={msg.content} role={msg.role} />
          )}
        </div>
      </div>
    );
  };

  if (workspace?.currentRevisionNumber === 0) {
    return <NewChartContent
      session={session}
      chatInput={chatInput}
      setChatInput={setChatInput}
      handleSubmitChat={handleSubmitChat}
    />
  }

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className={workspace?.currentRevisionNumber === 0 ? "" : "pb-32"}>
            {/* Only show DB messages if AI SDK hasn't started yet */}
            {aiMessages.length === 0 && messages && messages.map((item) => (
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
            {/* Show AI SDK streaming messages (includes user messages) */}
            {aiMessages.map(renderAIMessage)}
            {/* Show error if any */}
            {aiError && (
              <div className="px-2 py-1">
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                  Error: {aiError.message}
                </div>
              </div>
            )}
          </div>
        </ScrollingContent>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        <form onSubmit={handleSubmitChat} className="p-3 relative">
          <textarea
            value={chatInput ?? ''}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isRendering) {
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
            
            {/* Send/Stop button */}
            {isAILoading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className={`p-1.5 rounded-full ${
                  theme === "dark"
                    ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    : "text-red-500 hover:text-red-600 hover:bg-red-50"
                }`}
                title="Stop generating"
              >
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isRendering || !(chatInput ?? '').trim()}
                className={`p-1.5 rounded-full ${
                  isRendering || !(chatInput ?? '').trim()
                    ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                    : theme === "dark"
                      ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
