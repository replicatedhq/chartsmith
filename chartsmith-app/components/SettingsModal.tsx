import React, { useState } from 'react';
import { X, Trash2, Key } from 'lucide-react';
import { useTheme, Theme } from '@/contexts/ThemeContext';


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsSection {
  id: 'general' | 'replicated' | 'appearance' | 'editor';
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection['id']>('general');
  const { theme, setTheme } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiToken, setApiToken] = useState('');

  if (!isOpen) return null;

  const handleDeleteChats = () => {
    setIsDeleting(true);
    // Simulate deletion
    setTimeout(() => {
      setIsDeleting(false);
    }, 1000);
  };

  const handleSaveToken = async () => {
    // Simulate API call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  };

  const sections: SettingsSection[] = [
    {
      id: 'general',
      label: 'General',
      icon: <Trash2 className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <button
            onClick={handleDeleteChats}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete All Chats'}</span>
          </button>
        </div>
      ),
    },
    {
      id: 'replicated',
      label: 'Replicated',
      icon: <Key className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              API Token
            </label>
            <div className="space-y-2">
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste your Replicated API token"
                className={`w-full px-3 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
              />
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                You can find your API token in the Replicated vendor portal under Account Settings.
              </p>
            </div>
            <button
              onClick={handleSaveToken}
              disabled={!apiToken}
              className={`mt-4 px-4 py-2 rounded-lg text-white transition-colors ${
                apiToken
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
            >
              Save Token
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4.93 4.93L6.34 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M17.66 17.66L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.34 17.66L4.93 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19.07 4.93L17.66 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className={`w-full px-3 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-dark border-dark-border text-gray-300'
                    : 'bg-white border-gray-300 text-gray-900'
                } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
              >
                <option value="auto">Auto (System)</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
          </div>
        </div>
      ),
    },
    {
      id: 'editor',
      label: 'Editor',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.5 3.5C16.8978 3.10217 17.4374 2.87868 18 2.87868C18.2786 2.87868 18.5544 2.93355 18.8118 3.04015C19.0692 3.14676 19.303 3.30301 19.5 3.5C19.697 3.69698 19.8532 3.93083 19.9598 4.18821C20.0665 4.44558 20.1213 4.72142 20.1213 5C20.1213 5.27857 20.0665 5.55441 19.9598 5.81179C19.8532 6.06916 19.697 6.30301 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tab Size
            </label>
            <select className={`w-full px-3 py-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-dark border-dark-border text-gray-300'
                : 'bg-white border-gray-300 text-gray-900'
            } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}>
              <option>2 spaces</option>
              <option>4 spaces</option>
              <option>8 spaces</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="minimap"
              className={`rounded border transition-colors ${
                theme === 'dark'
                  ? 'border-dark-border bg-dark text-primary'
                  : 'border-gray-300 bg-white text-primary'
              } focus:ring-primary`}
            />
            <label htmlFor="minimap" className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Show Minimap
            </label>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-3xl h-[600px] rounded-lg shadow-lg border flex ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        {/* Left Navigation */}
        <div className={`w-48 border-r p-2 ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                activeSection === section.id
                  ? 'bg-primary/10 text-primary'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-dark-border/40'
                    : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col">
          <div className={`flex items-center justify-between p-4 border-b ${
            theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
          }`}>
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {sections.find((s) => s.id === activeSection)?.label} Settings
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
          <div className="flex-1 p-6 overflow-y-auto">
            {sections.find((s) => s.id === activeSection)?.content}
          </div>
        </div>
      </div>
    </div>
  );
}
