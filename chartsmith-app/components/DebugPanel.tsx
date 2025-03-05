import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAtom } from 'jotai';
import { selectedFileAtom } from '@/atoms/editor';

interface DebugPanelProps {
  isVisible: boolean;
}

export function DebugPanel({ isVisible }: DebugPanelProps) {
  const { resolvedTheme } = useTheme();
  const [selectedFile] = useAtom(selectedFileAtom);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed right-0 top-0 bottom-0 w-1/4 border-l shadow-lg overflow-auto z-10 ${
        resolvedTheme === "dark" 
          ? "bg-dark-surface border-dark-border text-gray-300" 
          : "bg-white border-gray-200 text-gray-700"
      }`}
    >
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Debug Panel</h2>
        
        {selectedFile?.pendingPatch ? (
          <div>
            <div className="mb-2 flex items-center">
              <h3 className="text-md font-medium">Pending Patch</h3>
              <span className="ml-2 text-xs opacity-70 font-mono">
                ({selectedFile.filePath?.split('/').pop()})
              </span>
            </div>
            <pre 
              className={`p-3 rounded text-xs font-mono overflow-auto max-h-[calc(100vh-150px)] whitespace-pre ${
                resolvedTheme === "dark" 
                  ? "bg-dark-border/40" 
                  : "bg-gray-100"
              }`}
            >
              {selectedFile.pendingPatch}
            </pre>
          </div>
        ) : (
          <p className="text-sm opacity-70">
            No pending patch for the selected file.
          </p>
        )}
      </div>
    </div>
  );
}
