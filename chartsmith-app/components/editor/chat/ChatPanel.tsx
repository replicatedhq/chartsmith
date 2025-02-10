import React, { useRef, useEffect } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useTheme } from "../../../contexts/ThemeContext";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onApplyChanges?: (message: Message) => void;
  session: Session;
  workspaceId: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function ChatPanel({ messages, onSendMessage, onApplyChanges, session, workspaceId, setMessages }: ChatPanelProps) {
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const parent = messagesEndRef.current.parentElement;
      if (parent) {
        parent.scrollTop = parent.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 min-h-0 ${theme === "dark" ? "bg-dark-surface" : "bg-gray-50"}`}>
        {[...messages].sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return aDate.getTime() - bDate.getTime(); // Oldest at top
        }).map((message, index) => (
          <ChatMessage
            key={message.id || index}
            message={message}
            onApplyChanges={() => onApplyChanges?.(message)}
            session={session}
            workspaceId={workspaceId}
            showActions={index === messages.length - 1}
            setMessages={setMessages}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSubmit={onSendMessage} />
    </>
  );
}
