"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Users, Code, User, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom, plansAtom, activeRenderIdsAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { NewChartContent } from "./NewChartContent";
import { useChat } from "@ai-sdk/react";

interface ChatContainerProps {
  session: Session;
}

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom)
  const [messages, setMessages] = useAtom(messagesAtom)
  const [, setPlans] = useAtom(plansAtom)
  const [isRendering] = useAtom(isRenderingAtom)
  const [activeRenderIds] = useAtom(activeRenderIdsAtom);
  const [selectedRole, setSelectedRole] = useState<"auto" | "developer" | "operator">("auto");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Initialize useChat
  const { status, messages: aiMessages, sendMessage, stop } = useChat({
    api: '/api/chat',
    id: workspace?.id,
    initialMessages: [],
    experimental_toolCallStreaming: true,
    onFinish: (message: any) => {
      // Sync the final message content to the atom
    },
    onError: (error: any) => {
      console.error("[CLIENT] useChat error:", error);
    },
  } as any);

  const isLoading = status === "submitted" || status === "streaming";

  // Debug stuck rendering state
  useEffect(() => {
    console.log("[CLIENT] Render State Debug:", { isRendering, activeRenderIds, isLoading });
  }, [isRendering, activeRenderIds, isLoading]);

  // Manual input state management since @ai-sdk/react useChat doesn't provide it
  const [input, setInput] = useState("");
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log("[CLIENT] handleSubmit triggered. input:", input, "isRendering:", isRendering, "isLoading:", isLoading);
    if (!input.trim() || !session || !workspace) {
      console.log("[CLIENT] handleSubmit early return. input:", input, "session:", !!session, "workspace:", !!workspace);
      return;
    }

    // 1. Create the user message in DB and Atom (optimistic)
    // Pass skipWorker=true to avoid triggering the legacy worker
    console.log("[CLIENT] Creating chat message action...");
    const chatMessage = await createChatMessageAction(session, workspace.id, input.trim(), selectedRole, true);
    console.log("[CLIENT] Chat message created:", chatMessage.id);
    setMessages(prev => [...prev, chatMessage]);

    // 2. Trigger useChat to send the message and stream response
    // We pass the chatMessageId so the server knows which message to update
    console.log("[CLIENT] Calling sendMessage...");
    await sendMessage({
      text: input,
    }, {
      body: {
        chatMessageId: chatMessage.id,
        workspaceId: workspace.id,
        session: session,
      }
    });

    setInput("");
  };

  // Helper to extract text from UIMessage
  const getTextFromUIMessage = (message: any): string => {
    if (message.parts) {
      return message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }
    return message.content || ''; // Fallback
  };

  // Sync aiMessages to messagesAtom
  // DISABLED: This causes infinite loops with streaming updates
  // TODO: Find a better way to sync aiMessages with messagesAtom
  /*
  useEffect(() => {
    if (aiMessages.length === 0) return;

    const lastAiMessage = aiMessages[aiMessages.length - 1];
    if (lastAiMessage.role !== 'assistant') return;

    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];

      // If the last message in atom is a user message (prompt), we assume this assistant message is the response.
      // BUT `createChatMessageAction` creates a row with `prompt` and `response` (initially null).
      // So the last message in atom IS the one we want to update.

      if (lastMessage && lastMessage.prompt && !lastMessage.isIntentComplete) {
        // Update the response of the last message
        const text = getTextFromUIMessage(lastAiMessage);
        // Only update if the text has actually changed to prevent infinite loops
        if (text && text !== lastMessage.response) {
          lastMessage.response = text;
          return newMessages;
        }
      }
      return prev; // Return previous state if no changes
    });
  }, [aiMessages]); // setMessages is stable, no need in deps
  */

  // Trigger AI response for pending user messages (e.g. from landing page)
  useEffect(() => {
    // Only run if we are ready and have messages
    if (status !== 'ready' || isLoading || messages.length === 0 || !session || !workspace) return;

    const lastMessage = messages[messages.length - 1];

    // Check if the last message is a user prompt that is NOT complete and has NO response
    // And ensure we haven't already tried to send it (avoid loops)
    if (lastMessage.prompt && !lastMessage.response && !lastMessage.isIntentComplete && !lastMessage.isCanceled) {
      // Check if we are already processing this message ID in aiMessages
      // If aiMessages is empty, we definitely need to trigger.
      if (aiMessages.length === 0) {
        console.log("[CLIENT] Found pending user message from handover. Triggering AI...", lastMessage.id);
        sendMessage({
          text: lastMessage.prompt,
        }, {
          body: {
            chatMessageId: lastMessage.id,
            workspaceId: workspace.id,
            session: session,
          }
        });
      }
    }
  }, [messages, status, isLoading, session, workspace, sendMessage, aiMessages]);

  useEffect(() => {
    if (status === 'ready' && !isLoading && workspace?.id && session) {
      // We use a small timeout to let the DB update fully
      const timer = setTimeout(() => {
        // Chain the requests to avoid potential race conditions with session validation
        import("@/lib/workspace/actions/get-workspace-messages").then(({ getWorkspaceMessagesAction }) => {
          getWorkspaceMessagesAction(session, workspace.id)
            .then((serverMessages) => {
              setMessages(serverMessages);

              // Only fetch plans if we have messages (optimization)
              return import("@/lib/workspace/actions/get-workspace-plans").then(({ getWorkspacePlansAction }) => {
                return getWorkspacePlansAction(session, workspace.id);
              });
            })
            .then((serverPlans) => {
              setPlans(serverPlans);
            })
            .catch((err) => {
              // Silently fail or log to error reporting service
              console.error("Failed to fetch chat data:", err);
            });
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status, isLoading, workspace?.id, session, setMessages]);

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
    // For NewChartContent, create a simpler version of handleSubmit that doesn't use role selector
    const handleNewChartSubmitChat = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log("[CLIENT] handleNewChartSubmitChat triggered. input:", input, "isRendering:", isRendering);
      if (!input.trim() || isRendering) {
        console.log("[CLIENT] handleNewChartSubmitChat early return.");
        return;
      }
      if (!session || !workspace) return;

      // Always use AUTO for new chart creation
      console.log("[CLIENT] (NewChart) Creating chat message action...");
      const chatMessage = await createChatMessageAction(session, workspace.id, input.trim(), "auto", true);
      setMessages(prev => [...prev, chatMessage]);

      console.log("[CLIENT] (NewChart) Calling sendMessage...");
      await sendMessage({
        text: input.trim(),
      }, {
        body: {
          chatMessageId: chatMessage.id,
          workspaceId: workspace.id,
          session: session
        }
      });

      setInput("");
    };

    return <NewChartContent
      session={session}
      chatInput={input}
      setChatInput={(val) => handleInputChange({ target: { value: val } } as any)}
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
        <form onSubmit={handleSubmit} className="p-3 relative">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isRendering) {
                  handleSubmit(e);
                }
              }
            }}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-24 text-sm rounded-md border resize-none overflow-hidden ${theme === "dark"
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
                className={`p-1.5 rounded-full ${theme === "dark"
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
                  className={`absolute bottom-full right-0 mb-1 w-56 rounded-lg shadow-lg border py-1 z-50 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
                    }`}
                >
                  <div className={`px-3 py-2 text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"
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
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${selectedRole === role
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
                          <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              disabled={isRendering || isLoading}
              className={`p-1.5 rounded-full ${isRendering || isLoading
                ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                : theme === "dark"
                  ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
            >
              {isRendering || isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
