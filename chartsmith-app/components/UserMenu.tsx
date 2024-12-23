"use client"

import React, { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <img
          src={user.avatar}
          alt={user.name}
          className="w-8 h-8 rounded-full"
        />
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border py-1 z-50 ${
          theme === 'dark'
            ? 'bg-dark-surface border-dark-border'
            : 'bg-white border-gray-200'
        }`}>
          <div className={`px-4 py-2 border-b ${
            theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
          }`}>
            <div className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {user.name}
            </div>
            <div className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {user.email}
            </div>
          </div>
          <button
            onClick={signOut}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              theme === 'dark'
                ? 'text-gray-300 hover:bg-dark-border/40'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
