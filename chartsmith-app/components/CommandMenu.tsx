import React from 'react';
import { Command } from 'cmdk';
import { useTheme } from '@/contexts/ThemeContext';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleDebug: () => void;
  isDebugVisible: boolean;
}

export function CommandMenu({ isOpen, onClose, onToggleDebug, isDebugVisible }: CommandMenuProps) {
  const { resolvedTheme } = useTheme();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when menu opens
  React.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Handle Escape key and click outside
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
            <Command.Group heading="Workspace">
              <Command.Item
                onSelect={() => {
                  onClose();
                  // TODO: Handle new workspace creation
                }}
                className={`px-3 py-2 rounded-sm text-sm cursor-pointer ${
                  resolvedTheme === "dark"
                    ? "hover:bg-dark-border/40"
                    : "hover:bg-gray-100"
                }`}
              >
                Create a new workspace
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onClose();
                  // TODO: Handle subchart addition
                }}
                className={`px-3 py-2 rounded-sm text-sm cursor-pointer ${
                  resolvedTheme === "dark"
                    ? "hover:bg-dark-border/40"
                    : "hover:bg-gray-100"
                }`}
              >
                Add a subchart
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Tools">
              <Command.Item
                onSelect={onToggleDebug}
                className={`px-3 py-2 rounded-sm text-sm cursor-pointer ${
                  resolvedTheme === "dark"
                    ? "hover:bg-dark-border/40"
                    : "hover:bg-gray-100"
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
