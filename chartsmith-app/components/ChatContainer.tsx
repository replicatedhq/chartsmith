"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Users, Code, User, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { NewChartContent } from "./NewChartContent";
import { useChartsmithChat, useVercelAiSdkEnabled } from "@/hooks/useChartsmithChat";
import type { Message } from "./types";

// Key for storing the initial prompt in localStorage (shared with PromptModal)
const INITIAL_PROMPT_KEY = "chartsmith_initial_prompt";

interface ChatContainerProps {
  session: Session;
}

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace, setWorkspace] = useAtom(workspaceAtom)
  const [messages, setMessages] = useAtom(messagesAtom)
  const [isRendering] = useAtom(isRenderingAtom)
  const [chatInput, setChatInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<"auto" | "developer" | "operator">("auto");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Check if Vercel AI SDK is enabled
  const useVercelAiSdk = useVercelAiSdkEnabled();

  // Use the Vercel AI SDK chat hook
  const {
    sendMessage: sendAiSdkMessage,
    isLoading: aiSdkLoading,
    streamingResponse,
    stop: stopStreaming,
  } = useChartsmithChat({
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onFinish: async (response) => {
      console.log("[ChatContainer] onFinish called, response length:", response?.length);

      // Mark the message as complete (handles empty response case when AI only uses tools)
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.id.startsWith("temp-")) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastMessage,
            response: response || lastMessage.response || "Chart files created.",
            isComplete: true,
            isIntentComplete: true,
          };
          return updated;
        }
        return prev;
      });

      // Refresh workspace to get newly created files from AI tools
      if (session && workspace?.id) {
        console.log("[ChatContainer] Refreshing workspace:", workspace.id);
        try {
          const freshWorkspace = await getWorkspaceAction(session, workspace.id);
          console.log("[ChatContainer] Got fresh workspace, files:", freshWorkspace?.files?.length, "charts:", freshWorkspace?.charts?.length, "chart files:", freshWorkspace?.charts?.[0]?.files?.length);
          if (freshWorkspace) {
            setWorkspace(freshWorkspace);
          }
        } catch (err) {
          console.error("[ChatContainer] Failed to refresh workspace:", err);
        }
      } else {
        console.log("[ChatContainer] Missing session or workspace.id", { session: !!session, workspaceId: workspace?.id });
      }
    },
  });

  // No need for refs as ScrollingContent manages its own scrolling

  // Update the last message with streaming response as it comes in
  useEffect(() => {
    if (!useVercelAiSdk || !streamingResponse) return;

    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const lastMessage = prev[prev.length - 1];
      // Only update if this is a temp message (created for AI SDK streaming)
      if (!lastMessage.id.startsWith("temp-")) return prev;
      // Avoid unnecessary updates if response hasn't changed
      if (lastMessage.response === streamingResponse && lastMessage.isComplete === !aiSdkLoading) {
        return prev;
      }
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...lastMessage,
        response: streamingResponse,
        isComplete: !aiSdkLoading,
        isIntentComplete: !aiSdkLoading,
      };
      return updated;
    });
  }, [streamingResponse, aiSdkLoading, useVercelAiSdk, setMessages]);

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

  // Check for initial prompt from localStorage (set by PromptModal)
  // This triggers the AI SDK chat for new workspaces
  useEffect(() => {
    if (!useVercelAiSdk || !workspace?.id || aiSdkLoading) {
      return;
    }

    try {
      const storedData = localStorage.getItem(INITIAL_PROMPT_KEY);
      if (!storedData) {
        return;
      }

      const { workspaceId, prompt } = JSON.parse(storedData);

      // Only process if this is the matching workspace
      if (workspaceId !== workspace.id) {
        return;
      }

      // Clear the stored prompt immediately to prevent re-triggering
      localStorage.removeItem(INITIAL_PROMPT_KEY);

      // Create placeholder message for UI
      const tempId = `temp-${Date.now()}`;
      const userMessage: Message = {
        id: tempId,
        prompt: prompt,
        createdAt: new Date(),
        isComplete: false,
        isIntentComplete: false,
      };
      setMessages([userMessage]);

      // Send message via AI SDK
      sendAiSdkMessage(prompt);
    } catch (err) {
      console.error("Error processing initial prompt:", err);
    }
  }, [useVercelAiSdk, workspace?.id, aiSdkLoading, sendAiSdkMessage, setMessages]);

  if (!messages || !workspace) {
    return null;
  }

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isRendering || aiSdkLoading) return; // Don't submit if rendering is in progress

    if (!session || !workspace) return;

    const messageText = chatInput.trim();
    setChatInput("");

    if (useVercelAiSdk) {
      // Use Vercel AI SDK for streaming chat
      // First, create a placeholder message for the UI
      const tempId = `temp-${Date.now()}`;
      const userMessage: Message = {
        id: tempId,
        prompt: messageText,
        createdAt: new Date(),
        isComplete: false,
        isIntentComplete: false,
      };
      setMessages(prev => [...prev, userMessage]);

      // Send message via AI SDK
      await sendAiSdkMessage(messageText);
    } else {
      // Fall back to original server action + work queue pattern
      const chatMessage = await createChatMessageAction(session, workspace.id, messageText, selectedRole);
      setMessages(prev => [...prev, chatMessage]);
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

  // Only use NewChartContent for revision 0 if NOT using Vercel AI SDK
  // When AI SDK is enabled, we use the regular chat interface since it handles streaming directly
  if (workspace?.currentRevisionNumber === 0 && !useVercelAiSdk) {
    // For NewChartContent, create a simpler version of handleSubmitChat that doesn't use role selector
    const handleNewChartSubmitChat = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isRendering) return;
      if (!session || !workspace) return;

      // Always use AUTO for new chart creation
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
                  onCancel={useVercelAiSdk ? stopStreaming : undefined}
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
              disabled={isRendering || aiSdkLoading}
              className={`p-1.5 rounded-full ${
                isRendering || aiSdkLoading
                  ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {isRendering || aiSdkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
