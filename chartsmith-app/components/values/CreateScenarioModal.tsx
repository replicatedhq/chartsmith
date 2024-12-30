import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesScenario } from '@/lib/types/workspace';

interface CreateScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (scenario: ValuesScenario) => void;
}

export function CreateScenarioModal({ isOpen, onClose, onSubmit }: CreateScenarioModalProps) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && values) {
      onSubmit({
        id: Math.random().toString(36).substr(2, 9),
        name,
        description,
        values,
        enabled: true,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-2xl rounded-lg shadow-lg border ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Create New Scenario</h2>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-dark border-dark-border text-gray-300'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-dark border-dark-border text-gray-300'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Values
            </label>
            <textarea
              value={values}
              onChange={(e) => setValues(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border h-48 ${
                theme === 'dark'
                  ? 'bg-dark border-dark-border text-gray-300'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60'
                  : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
