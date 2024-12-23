"use client"

import React from 'react';
import { X, Terminal, Copy } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface WorkInCliModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkInCliModal({ isOpen, onClose }: WorkInCliModalProps) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-2xl rounded-lg shadow-lg border ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark'
            ? 'border-dark-border'
            : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Work in CLI
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white'
                : 'text-gray-500 hover:text-gray-700'
            } transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <p className={`mb-4 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Install the Replicated CLI using Homebrew:
            </p>
            <div className="relative">
              <pre className={`p-4 rounded-lg font-mono text-sm ${
                theme === 'dark'
                  ? 'bg-dark text-gray-300'
                  : 'bg-gray-50 text-gray-700'
              }`}>
                brew install replicatedhq/replicated/cli
              </pre>
              <button
                onClick={() => handleCopy('brew install replicatedhq/replicated/cli')}
                className={`absolute top-2 right-2 p-2 ${
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <p className={`mb-4 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              To pull this chart locally:
            </p>
            <div className="relative">
              <pre className={`p-4 rounded-lg font-mono text-sm ${
                theme === 'dark'
                  ? 'bg-dark text-gray-300'
                  : 'bg-gray-50 text-gray-700'
              }`}>
                replicated chartsmith download boring-wozniak
              </pre>
              <button
                onClick={() => handleCopy('replicated chartsmith download boring-wozniak')}
                className={`absolute top-2 right-2 p-2 ${
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <p className={`mb-4 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              To upload your local changes:
            </p>
            <div className="relative">
              <pre className={`p-4 rounded-lg font-mono text-sm ${
                theme === 'dark'
                  ? 'bg-dark text-gray-300'
                  : 'bg-gray-50 text-gray-700'
              }`}>
                replicated chartsmith upload boring-wozniak ./
              </pre>
              <button
                onClick={() => handleCopy('replicated chartsmith upload boring-wozniak ./')}
                className={`absolute top-2 right-2 p-2 ${
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className={`flex justify-end p-4 border-t ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              theme === 'dark'
                ? 'text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60'
                : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
