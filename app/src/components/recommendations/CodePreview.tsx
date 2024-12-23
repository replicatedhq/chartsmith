import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { FileText } from 'lucide-react';

interface CodePreviewProps {
  filePath: string;
}

export function CodePreview({ filePath }: CodePreviewProps) {
  const { theme } = useTheme();

  return (
    <div className={`rounded-lg border overflow-hidden ${
      theme === 'dark'
        ? 'bg-dark-surface border-dark-border'
        : 'bg-white border-gray-200'
    }`}>
      <div className={`px-4 py-2 border-b flex items-center gap-2 ${
        theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
      }`}>
        <FileText className="w-4 h-4 text-primary" />
        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
          {filePath}
        </span>
      </div>
      <div className="p-4">
        <pre className={`text-sm font-mono ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {/* Placeholder for actual file content */}
          // File content will be loaded here
        </pre>
      </div>
    </div>
  );
}