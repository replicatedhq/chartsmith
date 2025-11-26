"use client";

import React, { createContext, useContext, useState } from "react";

interface WorkspaceUIContextType {
  isChatVisible: boolean;
  setIsChatVisible: (visible: boolean) => void;
  isFileTreeVisible: boolean;
  setIsFileTreeVisible: (visible: boolean) => void;
  isForging: boolean;
  setIsForging: (forging: boolean) => void;
}

const WorkspaceUIContext = createContext<WorkspaceUIContextType | undefined>(undefined);

export function WorkspaceUIProvider({
  children,
  initialChatVisible = true,
  initialFileTreeVisible = false
}: {
  children: React.ReactNode;
  initialChatVisible?: boolean;
  initialFileTreeVisible?: boolean;
}) {
  const [isChatVisible, setIsChatVisible] = useState(initialChatVisible);
  const [isFileTreeVisible, setIsFileTreeVisible] = useState(initialFileTreeVisible);
  const [isForging, setIsForging] = useState(false);

  return (
    <WorkspaceUIContext.Provider
      value={{
        isChatVisible,
        setIsChatVisible,
        isFileTreeVisible,
        setIsFileTreeVisible,
        isForging,
        setIsForging,
      }}
    >
      {children}
    </WorkspaceUIContext.Provider>
  );
}

export function useWorkspaceUI() {
  const context = useContext(WorkspaceUIContext);
  if (context === undefined) {
    throw new Error("useWorkspaceUI must be used within a WorkspaceUIProvider");
  }
  return context;
}

// Safe version that returns defaults when not in provider (for components like TopNav)
export function useWorkspaceUISafe() {
  const context = useContext(WorkspaceUIContext);
  return context ?? {
    isChatVisible: true,
    setIsChatVisible: () => {},
    isFileTreeVisible: false,
    setIsFileTreeVisible: () => {},
    isForging: false,
    setIsForging: () => {},
  };
}
