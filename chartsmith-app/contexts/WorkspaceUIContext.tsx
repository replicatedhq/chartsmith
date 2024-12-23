"use client"

import React, { createContext, useContext, useState } from 'react';

interface WorkspaceUIContextType {
  isChatVisible: boolean;
  setIsChatVisible: (visible: boolean) => void;
  isFileTreeVisible: boolean;
  setIsFileTreeVisible: (visible: boolean) => void;
}

const WorkspaceUIContext = createContext<WorkspaceUIContextType | undefined>(undefined);

export function WorkspaceUIProvider({ children }: { children: React.ReactNode }) {
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isFileTreeVisible, setIsFileTreeVisible] = useState(true);

  return (
    <WorkspaceUIContext.Provider value={{
      isChatVisible,
      setIsChatVisible,
      isFileTreeVisible,
      setIsFileTreeVisible
    }}>
      {children}
    </WorkspaceUIContext.Provider>
  );
}

export function useWorkspaceUI() {
  const context = useContext(WorkspaceUIContext);
  if (context === undefined) {
    throw new Error('useWorkspaceUI must be used within a WorkspaceUIProvider');
  }
  return context;
}
