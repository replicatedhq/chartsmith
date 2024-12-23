import React, { useState } from 'react';
import { User, LogOut, Settings } from 'lucide-react';
import { SettingsModal } from '../modals/SettingsModal';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative flex justify-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-dark-border/40 transition-colors text-gray-400 hover:text-gray-300"
      >
        <User className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-14 mb-2 w-48 bg-[#1E1E1E] rounded-lg shadow-lg border border-gray-800 py-1">
          <button 
            className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800/40 flex items-center gap-2"
            onClick={() => {
              setShowSettings(true);
              setIsOpen(false);
            }}
          >
            <Settings className="w-4 h-4" />
            Account Settings
          </button>
          <button className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800/40 flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}

      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}