import React from "react";
import { ChatPanel } from "./ChatPanel";
import { useTheme } from "../../../contexts/ThemeContext";
import { Message } from "../types";
import { Session } from "@/lib/types/session";

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onApplyChanges: (message: Message) => void;
  session: Session;
  workspaceId: string;
}

export function ChatContainer({ messages, onSendMessage, onApplyChanges, session, workspaceId }: ChatContainerProps) {
  const { theme } = useTheme();

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <ChatPanel 
        messages={messages} 
        onSendMessage={onSendMessage} 
        onApplyChanges={onApplyChanges}
        session={session}
        workspaceId={workspaceId}
      />
    </div>
  );
}
