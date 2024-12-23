import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Message } from '../editor/types';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
}

export function ReportIssueModal({ isOpen, onClose, message }: ReportIssueModalProps) {
  const { theme } = useTheme();
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      // Here you would typically send the report to your backend
      console.log('Issue reported:', {
        message,
        description,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-xl rounded-lg shadow-lg border ${
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
            <AlertTriangle className="w-5 h-5 text-error" />
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Report Issue
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h3 className={`text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Changes Made
            </h3>
            <div className={`p-4 rounded-lg ${
              theme === 'dark'
                ? 'bg-dark/40 text-gray-300'
                : 'bg-gray-50 text-gray-700'
            }`}>
              {message.changes || 'No changes recorded'}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              What's wrong with these changes?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue..."
              className={`w-full px-4 py-3 rounded-lg border resize-none h-32 ${
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
              disabled={!description.trim()}
              className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                description.trim()
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}