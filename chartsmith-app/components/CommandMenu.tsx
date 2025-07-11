"use client";

import React from 'react';
import { Command } from 'cmdk';
import { useTheme } from '@/contexts/ThemeContext';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleDebug: () => void;
  isDebugVisible: boolean;
}

export default function CommandMenu({ isOpen, onClose, onToggleDebug, isDebugVisible }: CommandMenuProps) {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('[cmdk-root]')) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const getAvailableThemes = () => {
    const themes = ['light', 'dark', 'auto'] as const;
    return themes.filter(t => t !== theme);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[640px]">
        <Command
          className={`rounded-lg shadow-lg border overflow-hidden ${
            resolvedTheme === "dark"
              ? "bg-dark-surface border-dark-border text-gray-300"
              : "bg-white border-gray-200 text-gray-700"
          }`}
          loop
        >
          <Command.Input
            ref={inputRef}
            placeholder="Type a command or search..."
            className={`w-full px-4 py-3 outline-none border-b ${
              resolvedTheme === "dark"
                ? "bg-dark-surface border-dark-border"
                : "bg-white border-gray-200"
            }`}
          />
          <Command.List className="max-h-[300px] overflow-auto p-2">
            <Command.Group heading="Theme">
              {getAvailableThemes().map((themeOption) => (
                <Command.Item
                  key={themeOption}
                  onSelect={() => {
                    setTheme(themeOption);
                    onClose();
                  }}
                  className={`px-3 py-2 rounded-sm text-sm cursor-pointer ${
                    resolvedTheme === "dark"
                      ? "hover:bg-dark-border/40 aria-selected:bg-dark-border/40"
                      : "hover:bg-gray-100 aria-selected:bg-gray-100"
                  }`}
                >
                  Switch to {themeOption} theme
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Tools">
              <Command.Item
                onSelect={() => {
                  onToggleDebug();
                  onClose();
                }}
                className={`px-3 py-2 rounded-sm text-sm cursor-pointer ${
                  resolvedTheme === "dark"
                    ? "hover:bg-dark-border/40 aria-selected:bg-dark-border/40"
                    : "hover:bg-gray-100 aria-selected:bg-gray-100"
                }`}
              >
                {isDebugVisible ? "Hide" : "Show"} Debug Terminal
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
