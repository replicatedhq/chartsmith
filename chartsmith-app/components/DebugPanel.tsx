import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAtom } from 'jotai';
import { selectedFileAtom } from '@/atoms/workspace';

interface DebugPanelProps {
  isVisible: boolean;
}

export function DebugPanel({ isVisible }: DebugPanelProps) {
  const { resolvedTheme } = useTheme();
  const [selectedFile] = useAtom(selectedFileAtom);

  if (!isVisible) return null;

  console.log("selectedFile", selectedFile);
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

        {selectedFile && (
          <>
            {/* File metadata */}
            <div className="mb-4 p-3 rounded text-xs font-mono border border-gray-200 dark:border-dark-border">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div className="font-semibold text-gray-500 dark:text-gray-400">ID:</div>
                <div>{selectedFile.id || 'N/A'}</div>
                <div className="font-semibold text-gray-500 dark:text-gray-400">Path:</div>
                <div className="break-all">{selectedFile.filePath || 'N/A'}</div>
              </div>
            </div>

            {(selectedFile.contentPending) && (
              <div className="mb-6">
                <div className="mb-2 flex items-center">
                  <h3 className="text-md font-medium">
                    Pending Content
                  </h3>
                  <span className="ml-2 text-xs opacity-70 font-mono">
                    ({selectedFile.filePath?.split('/').pop()})
                  </span>
                </div>
                <pre
                  className={`p-3 rounded text-xs font-mono overflow-auto max-h-[calc(100vh-250px)] whitespace-pre ${
                    resolvedTheme === "dark"
                      ? "bg-dark-border/40"
                      : "bg-gray-100"
                  }`}
                >
                  {selectedFile.contentPending}
                </pre>
              </div>
            )}

          </>
        )}

        {!selectedFile && (
          <p className="text-sm opacity-70">
            Select a file to view pending changes.
          </p>
        )}
      </div>
    </div>
  );
}
