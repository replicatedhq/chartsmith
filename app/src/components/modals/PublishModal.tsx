import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PublishModal({ isOpen, onClose }: PublishModalProps) {
  const [selectedApp, setSelectedApp] = useState('');
  const [shouldPromote, setShouldPromote] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('');
  const { theme } = useTheme();

  if (!isOpen) return null;

  const apps = ['SlackerNews', 'Other App'];
  const channels = ['Unstable', 'Beta', 'Stable'];

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
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Publish to Replicated
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
        <div className="p-4 space-y-4">
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            This will create a new release of your Helm chart in the Replicated platform.
          </p>
          
          <div className="space-y-2">
            <label className={`block text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Select Application
            </label>
            <div className="relative">
              <select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg appearance-none pr-8 border ${
                  theme === 'dark'
                    ? 'bg-dark border-dark-border text-gray-300'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary'
                }`}
              >
                <option value="">Select an application...</option>
                {apps.map((app) => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </select>
              <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={shouldPromote}
                onChange={(e) => setShouldPromote(e.target.checked)}
                className={`rounded border-2 ${
                  theme === 'dark' 
                    ? 'bg-dark border-dark-border text-primary focus:ring-primary' 
                    : 'bg-white border-gray-300 text-primary focus:ring-primary'
                }`}
              />
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Promote to channel
              </span>
            </label>

            {shouldPromote && (
              <div className="relative mt-2">
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg appearance-none pr-8 border ${
                    theme === 'dark'
                      ? 'bg-dark border-dark-border text-gray-300'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary'
                  }`}
                >
                  <option value="">Select a channel...</option>
                  {channels.map((channel) => (
                    <option key={channel} value={channel}>{channel}</option>
                  ))}
                </select>
                <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} />
              </div>
            )}
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
            Cancel
          </button>
          <button 
            className={`px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors ${
              (!selectedApp || (shouldPromote && !selectedChannel)) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={!selectedApp || (shouldPromote && !selectedChannel)}
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}