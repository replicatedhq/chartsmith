import React from 'react';
import { ChatPanel } from './ChatPanel';
import { useTheme } from '../../../contexts/ThemeContext';
import { Message } from '../types';

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onUndoChanges: (message: Message) => void;
}

export function ChatContainer({ messages, onSendMessage, onUndoChanges }: ChatContainerProps) {
  const { theme } = useTheme();

  return (
    <div className={`w-[400px] border-r flex flex-col min-h-0 overflow-hidden ${
      theme === 'dark' 
        ? 'bg-dark-surface border-dark-border' 
        : 'bg-white border-gray-200'
    }`}>
      <ChatPanel 
        messages={messages} 
        onSendMessage={onSendMessage}
        onUndoChanges={onUndoChanges}
      />
    </div>
  );
}