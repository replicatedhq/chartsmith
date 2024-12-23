import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Bot } from 'lucide-react';

interface ExplanationCardProps {
  explanation?: string;
}

export function ExplanationCard({ explanation }: ExplanationCardProps) {
  const { theme } = useTheme();

  if (!explanation) return null;

  return (
    <div className={`p-6 rounded-lg border ${
      theme === 'dark'
        ? 'bg-dark-surface border-dark-border'
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start gap-4">
        <Bot className="w-5 h-5 mt-1 text-primary" />
        <div>
          <h2 className={`text-lg font-semibold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            AI Explanation
          </h2>
          <div className={`prose ${theme === 'dark' ? 'prose-invert' : ''} max-w-none`}>
            {explanation}
          </div>
        </div>
      </div>
    </div>
  );
}