"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Send, Loader2, Code, User, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartContent } from "./NewChartContent";
import { routeChatMessage, ChatMessageIntent } from "@/lib/chat/router";
import { ModelSelector } from "./ModelSelector";
import { Message as ChartsmithMessage } from "./types";
import { ConversationalMessage } from "./ConversationalMessage";

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
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferredModelId') || undefined;
    }
    return undefined;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  
  // Memoize the transport to prevent recreation on every render
  const chatTransport = useMemo(() => new TextStreamChatTransport({
    api: '/api/chat',
    credentials: 'include', // Ensure cookies are sent with requests
    body: {
      workspaceId: workspace?.id,
      modelId: selectedModelId,
    },
  }), [workspace?.id, selectedModelId]);
  
  // Vercel AI SDK useChat hook for conversational messages
  const { 
    messages: aiMessages, 
    sendMessage,
    status: aiStatus,
  } = useChat({
    transport: chatTransport,
  });
  
  const aiIsLoading = aiStatus === 'streaming' || aiStatus === 'submitted';

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

  // Display messages type for rendering
  type DisplayItem = 
    | { type: 'chartsmith'; message: ChartsmithMessage }
    | { type: 'ai'; message: UIMessage };

  // Merge Chartsmith messages with AI SDK messages for display
  // Chartsmith messages maintain their server order (already sorted by database), then AI messages
  const displayMessages = useMemo((): DisplayItem[] => {
    const items: DisplayItem[] = [];
    
    // Add all Chartsmith messages in their original order (server returns them sorted)
    // Don't re-sort - the database already returns them in creation order
    for (const msg of messages) {
      items.push({ type: 'chartsmith', message: msg });
    }
    
    // Add AI messages (conversational) - these maintain their own order
    for (const msg of aiMessages) {
      items.push({ type: 'ai', message: msg });
    }
    
    return items;
  }, [messages, aiMessages]);

  if (!messages || !workspace) {
    return null;
  }

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isRendering || isProcessing || aiIsLoading) return;

    if (!session || !workspace) return;

    const messageText = chatInput.trim();
    setChatInput(""); // Clear input immediately for better UX
    setIsProcessing(true);

    try {
      const route = await routeChatMessage(messageText);

      if (route.useAISDK && route.intent === ChatMessageIntent.NON_PLAN) {
        // Conversational message - use Vercel AI SDK
        await sendMessage({
          text: messageText,
        });
      } else {
        // Plan-related message - use existing Chartsmith flow
        const chatMessage = await createChatMessageAction(
          session,
          workspace.id,
          messageText,
          selectedRole,
          selectedModelId
        );
        
        // Add the new message to state (check for duplicates from Centrifugo)
        setMessages(currentMessages => {
          if (currentMessages.some(m => m.id === chatMessage.id)) {
            return currentMessages;
          }
          return [...currentMessages, chatMessage];
        });
      }
    } catch (error) {
      // Restore input on error
      setChatInput(messageText);
      console.error('Error sending message:', error);
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

  if (workspace?.currentRevisionNumber === 0) {
    const handleNewChartSubmitChat = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isRendering) return;
      if (!session || !workspace) return;

      const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim(), "auto", selectedModelId);
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

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className={workspace?.currentRevisionNumber === 0 ? "" : "pb-32"}>
            {displayMessages.map((item) => (
              <div key={`${item.type}-${item.message.id}`}>
                {item.type === 'chartsmith' ? (
                  <ChatMessage
                    messageId={item.message.id}
                    session={session}
                    onContentUpdate={() => {}}
                  />
                ) : (
                  <ConversationalMessage
                    message={item.message}
                    isLoading={aiIsLoading && item.message === aiMessages[aiMessages.length - 1]}
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollingContent>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        <form onSubmit={handleSubmitChat} className="p-3">
          <div className={`relative flex flex-col rounded-md border ${
            theme === "dark"
              ? "bg-dark border-dark-border/60"
              : "bg-white border-gray-200"
          } focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50`}>
            <div className="relative">
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
                className={`w-full px-3 py-1.5 pr-24 text-sm resize-none overflow-hidden border-0 bg-transparent ${
                  theme === "dark"
                    ? "text-white placeholder-gray-500"
                    : "text-gray-900 placeholder-gray-400"
                } focus:outline-none`}
              />
              
              <div className="absolute right-3 top-3 flex gap-2">
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
            </div>
            
            <div className={`px-3 py-1.5 flex items-center border-t ${
              theme === "dark" ? "border-dark-border/40" : "border-gray-200/60"
            }`}>
              <ModelSelector
                selectedModelId={selectedModelId}
                onModelChange={(modelId) => {
                  setSelectedModelId(modelId);
                  localStorage.setItem('preferredModelId', modelId);
                }}
                compact={true}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}