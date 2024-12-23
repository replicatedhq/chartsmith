import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChatMessage } from './ChatMessage';
import { Message } from './types';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onUndoChanges?: (message: Message) => void;
}

export function ChatPanel({ messages, onSendMessage, onUndoChanges }: ChatPanelProps) {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            message={message}
            onUndo={() => onUndoChanges?.(message)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className={`p-4 border-t ${
        theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
      }`}>
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className={`w-full px-4 py-3 rounded-lg ${
              theme === 'dark' 
                ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500' 
                : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400'
            } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
          />
          <button
            type="submit"
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </>
  );
}