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
    <div className="fixed inset-0 bg-forge-black/80 backdrop-blur-sm z-50">
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[640px]">
        <Command
          className={`rounded-forge-lg shadow-2xl border overflow-hidden ${
            resolvedTheme === "dark"
              ? "bg-forge-charcoal border-forge-iron text-forge-silver"
              : "bg-white border-stone-200 text-stone-700"
          }`}
          loop
        >
          <Command.Input
            ref={inputRef}
            placeholder="Type a command or search..."
            className={`w-full px-4 py-4 outline-none border-b text-base ${
              resolvedTheme === "dark"
                ? "bg-forge-charcoal border-forge-iron placeholder-forge-zinc"
                : "bg-white border-stone-200 placeholder-stone-400"
            }`}
          />
          <Command.List className="max-h-[300px] overflow-auto p-2">
            <Command.Group heading="Theme" className="text-xs font-medium text-forge-zinc uppercase tracking-wider px-2 py-2">
              {getAvailableThemes().map((themeOption) => (
                <Command.Item
                  key={themeOption}
                  onSelect={() => {
                    setTheme(themeOption);
                    onClose();
                  }}
                  className={`px-3 py-2.5 rounded-forge text-sm cursor-pointer transition-all ${
                    resolvedTheme === "dark"
                      ? "hover:bg-forge-iron/50 aria-selected:bg-forge-ember/15 aria-selected:text-forge-ember"
                      : "hover:bg-stone-100 aria-selected:bg-orange-50 aria-selected:text-forge-ember"
                  }`}
                >
                  Switch to {themeOption} theme
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Tools" className="text-xs font-medium text-forge-zinc uppercase tracking-wider px-2 py-2">
              <Command.Item
                onSelect={() => {
                  onToggleDebug();
                  onClose();
                }}
                className={`px-3 py-2.5 rounded-forge text-sm cursor-pointer transition-all ${
                  resolvedTheme === "dark"
                    ? "hover:bg-forge-iron/50 aria-selected:bg-forge-ember/15 aria-selected:text-forge-ember"
                    : "hover:bg-stone-100 aria-selected:bg-orange-50 aria-selected:text-forge-ember"
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
