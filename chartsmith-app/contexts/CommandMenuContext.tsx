"use client"
import React, { createContext, useContext, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface CommandMenuContextType {
  openCommandMenu: () => void;
  isCommandMenuOpen: boolean;
  setIsCommandMenuOpen: (open: boolean) => void;
  isDebugVisible: boolean;
  setIsDebugVisible: (visible: boolean) => void;
}

const CommandMenuContext = createContext<CommandMenuContextType | undefined>(undefined);

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  // Add global hotkey
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault();
      setIsCommandMenuOpen(true);
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true
    }
  );

  const value = {
    openCommandMenu: () => {
      setIsCommandMenuOpen(true);
    },
    isCommandMenuOpen,
    setIsCommandMenuOpen,
    isDebugVisible,
    setIsDebugVisible
  };

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
    </CommandMenuContext.Provider>
  );
}

export function useCommandMenu() {
  const context = useContext(CommandMenuContext);
  if (context === undefined) {
    throw new Error('useCommandMenu must be used within a CommandMenuProvider');
  }
  return context;
}
