"use client"

import { SideNav } from '@/components/SideNav';
import { useTheme } from '@/contexts/ThemeContext';
import { WorkspaceUIProvider, useWorkspaceUI } from '@/contexts/WorkspaceUIContext';
import React from 'react';

function WorkspaceLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { theme } = useTheme();
  const { isChatVisible, setIsChatVisible, isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();

  const showSideNav = true;
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-dark' : 'bg-white'} flex w-full`}>
      {showSideNav && (
        <SideNav
          isChatVisible={isChatVisible}
          onToggleChat={() => setIsChatVisible(!isChatVisible)}
          isFileTreeVisible={isFileTreeVisible}
          onToggleFileTree={() => setIsFileTreeVisible(!isFileTreeVisible)}
        />
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WorkspaceUIProvider>
      <WorkspaceLayoutContent>
        {children}
      </WorkspaceLayoutContent>
    </WorkspaceUIProvider>
  );
}
