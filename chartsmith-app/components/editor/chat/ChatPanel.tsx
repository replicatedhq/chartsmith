import React, { useRef, useEffect } from "react";
import { Message } from "../types";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useTheme } from "../../../contexts/ThemeContext";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onUndoChanges?: (message: Message) => void;
}

export function ChatPanel({ messages, onSendMessage, onUndoChanges }: ChatPanelProps) {
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${theme === "dark" ? "bg-dark-surface" : "bg-gray-50"}`}>
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} onUndo={() => onUndoChanges?.(message)} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSubmit={onSendMessage} />
    </>
  );
}
