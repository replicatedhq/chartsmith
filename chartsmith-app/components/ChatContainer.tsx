"use client";
import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Message } from "./types";
import { Session } from "@/lib/types/session";
import { Plan } from "@/lib/types/workspace";
import { PlanChatMessage } from "./PlanChatMessage";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, plansAtom, rendersAtom, workspaceAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { ScrollingContent } from "./ScrollingContent";

interface ChatContainerProps {
  session: Session;
}

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom)
  const [messages, setMessages] = useAtom(messagesAtom)
  const [chatInput, setChatInput] = useState("");
  // No need for refs as ScrollingContent manages its own scrolling

  if (!messages || !workspace) {
    return null;
  }

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (!session || !workspace) return;

    const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim());
    setMessages(prev => [...prev, chatMessage]);

    setChatInput("");
  };

  // ScrollingContent will now handle all the scrolling behavior

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
      {workspace?.currentRevisionNumber && workspace?.currentRevisionNumber > 0 && (
        <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <form onSubmit={handleSubmitChat} className="p-3 relative">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitChat(e);
                }
              }}
              placeholder="Type your message..."
              rows={3}
              style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
              className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                theme === "dark"
                  ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                  : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
              } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
            />
            <button
              type="submit"
              className={`absolute right-4 top-[18px] p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border/40 ${
                theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
