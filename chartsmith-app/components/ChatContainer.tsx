"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Users, Code, User, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

type AIMessage = {
  id: string;
  role: string;
  content: string;
  createdAt?: Date;
};
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { NewChartContent } from "./NewChartContent";
import { routeChatMessage } from "@/lib/chat/router";
import { ModelSelector } from "./ModelSelector";
import { Message as ChartsmithMessage } from "./types";

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
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(() => {
    // Load model preference from localStorage on mount
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferredModelId') || undefined;
    }
    return undefined;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  
  // AI SDK state for conversational chat
  const [aiMessages, setAIMessages] = useState<AIMessage[]>([]);
  const [aiIsLoading, setAIIsLoading] = useState(false);
  
  // Append AI SDK message for conversational chat routing
  const appendAIMessage = async (message: { role: string; content: string }) => {
    setAIIsLoading(true);
    try {
      const userMsg: AIMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message.content,
      };
      setAIMessages(prev => [...prev, userMsg]);
    } catch (error) {
      // Error handled silently - will retry on next attempt
    } finally {
      setAIIsLoading(false);
    }
  };

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

  // Sync AI SDK message to Jotai state for consistency
  const syncAIMessageToJotai = (aiMessage: AIMessage) => {
    // Convert AI SDK message format to Chartsmith message format
    const chartsmithMessage: ChartsmithMessage = {
      id: aiMessage.id,
      prompt: aiMessage.role === 'user' ? aiMessage.content : '',
      response: aiMessage.role === 'assistant' ? aiMessage.content : undefined,
      isComplete: true,
      createdAt: aiMessage.createdAt || new Date(),
      workspaceId: workspace?.id,
      userId: session?.user?.id,
      isIntentComplete: true,
    };
    
    // Only add if not already in messages (avoid duplicates)
    setMessages(prev => {
      const exists = prev.some(m => m.id === chartsmithMessage.id);
      if (exists) return prev;
      return [...prev, chartsmithMessage];
    });
  };

  // Merge messages from both sources for display
  const mergeMessages = (): ChartsmithMessage[] => {
    // Start with Jotai messages (from Go backend)
    const merged = [...messages];
    
    // Add AI SDK messages that aren't already in Jotai
    const jotaiIds = new Set(messages.map(m => m.id));
    
    for (const aiMsg of aiMessages) {
      if (!jotaiIds.has(aiMsg.id)) {
        merged.push({
          id: aiMsg.id,
          prompt: aiMsg.role === 'user' ? aiMsg.content : '',
          response: aiMsg.role === 'assistant' ? aiMsg.content : undefined,
          isComplete: true,
          createdAt: aiMsg.createdAt || new Date(),
          workspaceId: workspace?.id,
          userId: session?.user?.id,
          isIntentComplete: true,
        });
      }
    }
    
    // Sort by creation date
    return merged.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  };

  if (!messages || !workspace) {
    return null;
  }

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isRendering || isProcessing || aiIsLoading) return;

    if (!session || !workspace) return;

    setIsProcessing(true);

    try {
      // Determine where to route this message
      const route = await routeChatMessage(chatInput.trim());

      if (route.useAISDK) {
        // Simple conversational chat -> AI SDK
        await appendAIMessage({
          role: 'user',
          content: chatInput.trim(),
        });
        setChatInput("");
      } else {
        // Complex operations (plans, conversions) -> Go backend
        const chatMessage = await createChatMessageAction(
          session,
          workspace.id,
          chatInput.trim(),
          selectedRole
        );
        setMessages(prev => [...prev, chatMessage]);
        setChatInput("");
      }
    } catch (error) {
      // Error handled silently - user can retry
    } finally {
      setIsProcessing(false);
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
    const handleNewChartSubmitChat = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isRendering) return;
      if (!session || !workspace) return;

      const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim(), "auto");
      setMessages(prev => [...prev, chatMessage]);
      setChatInput("");
    };
    
    return <NewChartContent
      session={session}
      chatInput={chatInput}
      setChatInput={setChatInput}
      handleSubmitChat={handleNewChartSubmitChat}
    />
  }

  // Get merged messages for display
  const displayMessages = mergeMessages();

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
                  onContentUpdate={() => {}}
                />
              </div>
            ))}
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
                if (!isRendering) {
                  handleSubmitChat(e);
                }
              }
            }}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-24 pb-8 text-sm rounded-md border resize-none overflow-hidden ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
          />
          
          {/* Model selector in bottom left */}
          <div className={`absolute bottom-2 left-4 z-10 ${theme === "dark" ? "" : ""}`}>
            <ModelSelector
              selectedModelId={selectedModelId}
              onModelChange={(modelId) => {
                setSelectedModelId(modelId);
                // Save to localStorage so it persists
                localStorage.setItem('preferredModelId', modelId);
              }}
            />
          </div>
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
              disabled={isRendering || isProcessing || aiIsLoading}
              className={`p-1.5 rounded-full ${
                isRendering || isProcessing || aiIsLoading
                  ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {(isRendering || isProcessing || aiIsLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}