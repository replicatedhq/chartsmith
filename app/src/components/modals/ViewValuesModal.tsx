import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import Editor from '@monaco-editor/react';

interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
}

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
      <div className={`w-full max-w-4xl h-[600px] rounded-lg shadow-lg border flex flex-col ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark'
            ? 'border-dark-border'
            : 'border-gray-200'
        }`}>
          <div>
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {scenario.name}
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {scenario.description}
            </p>
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
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            defaultLanguage="yaml"
            value={scenario.values}
            theme={theme === 'light' ? 'vs' : 'vs-dark'}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}