import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface DebugPanelProps {
  isVisible: boolean;
}

export function DebugPanel({ isVisible }: DebugPanelProps) {
  const { resolvedTheme } = useTheme();

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed right-0 top-0 bottom-0 w-1/4 border-l shadow-lg overflow-auto ${
        resolvedTheme === "dark" 
          ? "bg-dark-surface border-dark-border text-gray-300" 
          : "bg-white border-gray-200 text-gray-700"
      }`}
    >
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Debug Panel</h2>
        {/* Add debug content here */}
      </div>
    </div>
  );
}
