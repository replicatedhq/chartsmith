"use client";
import React, { useRef, useEffect, useState } from "react";
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

interface ChatContainerProps {
  session: Session;
}

function createMessagePlanMap(currentPlans: Plan[], messages: Message[]): Map<Message[], Plan> {
  const userMessagePlanMap = new Map<Message[], Plan>();
  const messageMap = new Map(messages.map(message => [message.id, message]));

  // Process plans in chronological order
  const sortedPlans = [...currentPlans].sort((a, b) => {
    const aMessage = messages.find(m => m.id === a.chatMessageIds[0]);
    const bMessage = messages.find(m => m.id === b.chatMessageIds[0]);
    const aTime = aMessage?.createdAt ? new Date(aMessage.createdAt).getTime() : 0;
    const bTime = bMessage?.createdAt ? new Date(bMessage.createdAt).getTime() : 0;
    return aTime - bTime;
  });

  for (const plan of sortedPlans) {
    const planMessages = plan.chatMessageIds
      .map(id => messageMap.get(id))
      .filter((message): message is Message => message !== undefined)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });

    if (planMessages.length > 0) {
      userMessagePlanMap.set(planMessages, plan);
    }
  }

  return userMessagePlanMap;
}

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [renders] = useAtom(rendersAtom)
  const [plans] = useAtom(plansAtom);
  const [workspace, setWorkspace] = useAtom(workspaceAtom)
  const [messages, setMessages] = useAtom(messagesAtom)
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="pb-32">
          {messages.map((item, index) => (
            <div key={item.id}>
              <ChatMessage
                key={item.id}
                messageId={item.id}
                session={session}
              />
              {item.responsePlanId ? (
                <PlanChatMessage
                  planId={item.responsePlanId}
                  session={session}
                  workspaceId={workspace.id}
                  messageId={item.id}
                  showActions={index === messages.length - 1}
                  showChatInput={false}
                />
              ) : null}
            </div>
          ))}
        </div>
        <style jsx>{`
          @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
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
