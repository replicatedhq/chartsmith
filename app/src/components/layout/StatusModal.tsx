import React from 'react';
import { X, RotateCw } from 'lucide-react';
import { StatusIndicator, type Status } from './StatusIndicator';
import { useTheme } from '../../contexts/ThemeContext';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    label: string;
    status: Status;
  };
}

export function StatusModal({ isOpen, onClose, item }: StatusModalProps) {
  const { theme } = useTheme();
  
  if (!isOpen) return null;

  const handleRerun = () => {
    // Add rerun logic here
    console.log('Rerunning:', item.label);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-md rounded-lg shadow-lg border ${
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
            <StatusIndicator status={item.status} className="w-3 h-3" />
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {item.label}
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
        <div className="p-4">
          <div className="space-y-4">
            <div className={`rounded-lg p-4 ${
              theme === 'dark' 
                ? 'bg-dark/40' 
                : 'bg-gray-50'
            }`}>
              <h3 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Status Details
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {item.status === 'success' && 'All checks passed successfully'}
                {item.status === 'warning' && 'Some checks require attention'}
                {item.status === 'error' && 'Critical issues detected'}
                {item.status === 'loading' && 'Running checks...'}
              </p>
            </div>
            <div className={`rounded-lg p-4 ${
              theme === 'dark' 
                ? 'bg-dark/40' 
                : 'bg-gray-50'
            }`}>
              <h3 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Last Updated
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className={`flex justify-end gap-2 p-4 border-t ${
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
          <button
            onClick={handleRerun}
            className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
              theme === 'dark'
                ? 'text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60'
                : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            Rerun
          </button>
          <button className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}