import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

interface ChatInputProps {
  onSubmit: (message: string) => void;
}

export function ChatInput({ onSubmit }: ChatInputProps) {
  const { theme } = useTheme();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
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
  );
}