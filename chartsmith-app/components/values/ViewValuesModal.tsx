import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesScenario } from '@/lib/types/workspace';

interface ViewValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: ValuesScenario | null;
}

export function ViewValuesModal({ isOpen, onClose, scenario }: ViewValuesModalProps) {
  const { theme } = useTheme();

  if (!isOpen || !scenario) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-3xl h-[600px] rounded-lg shadow-lg border flex flex-col ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>{scenario.name}</h2>
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
        <div className="flex-1 p-6 overflow-auto">
          <pre className={`p-4 rounded-lg ${
            theme === 'dark' ? 'bg-dark/40 text-gray-300' : 'bg-gray-50 text-gray-700'
          }`}>
            {scenario.values}
          </pre>
        </div>
      </div>
    </div>
  );
}
