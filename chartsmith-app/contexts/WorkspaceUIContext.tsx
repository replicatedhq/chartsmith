"use client";

import React, { createContext, useContext, useState } from "react";

interface WorkspaceUIContextType {
  isChatVisible: boolean;
  setIsChatVisible: (visible: boolean) => void;
  isFileTreeVisible: boolean;
  setIsFileTreeVisible: (visible: boolean) => void;
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

  return (
    <WorkspaceUIContext.Provider
      value={{
        isChatVisible,
        setIsChatVisible,
        isFileTreeVisible,
        setIsFileTreeVisible,
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
