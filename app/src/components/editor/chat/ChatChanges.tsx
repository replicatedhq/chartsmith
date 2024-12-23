import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';

interface ChatChangesProps {
  changes: string;
}

export function ChatChanges({ changes }: ChatChangesProps) {
  const { theme } = useTheme();

  return (
    <div className={`p-3 rounded ${
      theme === 'dark' ? 'bg-dark/40' : 'bg-gray-100'
    }`}>
      <div className={`text-sm font-medium mb-1 ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      }`}>
        Changes Made:
      </div>
      <div className={`text-sm ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      }`}>
        {changes}
      </div>
    </div>
  );
}