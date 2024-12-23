import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
}

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
    if (name.trim() && values.trim()) {
      onSubmit({
        id: Date.now().toString(),
        name: name.trim(),
        description: description.trim(),
        values: values.trim(),
      });
      setName('');
      setDescription('');
      setValues('');
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
          theme === 'dark' 
            ? 'border-dark-border' 
            : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Create Values Scenario
          </h2>
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
              Scenario Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production, Development, Testing"
              className={`w-full px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
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
              placeholder="Brief description of this scenario"
              className={`w-full px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
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
              placeholder="Paste your values.yaml content here"
              rows={10}
              className={`w-full px-4 py-2 rounded-lg border font-mono ${
                theme === 'dark'
                  ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
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
              disabled={!name.trim() || !values.trim()}
              className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                name.trim() && values.trim()
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
            >
              Create Scenario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}