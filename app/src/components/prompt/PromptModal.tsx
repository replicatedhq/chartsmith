import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { PromptInput } from './PromptInput';
import { useChartCreation } from '../../hooks/useChartCreation';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptModal({ isOpen, onClose }: PromptModalProps) {
  const { theme } = useTheme();
  const { isLoading, error, createFromPrompt } = useChartCreation();

  if (!isOpen) return null;

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
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Create Chart from Prompt
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
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-error/10 text-error rounded-lg">
              {error}
            </div>
          )}
          <PromptInput 
            onSubmit={createFromPrompt} 
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}