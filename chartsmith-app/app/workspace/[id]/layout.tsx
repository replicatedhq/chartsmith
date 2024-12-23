"use client"

import { SideNav } from '@/components/SideNav';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { theme } = useTheme();

  const [isChatVisible, setIsChatVisible] = React.useState(true);
  const [isFileTreeVisible, setIsFileTreeVisible] = React.useState(true);

  const showSideNav = true;
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-dark' : 'bg-white'} flex`}>
      {showSideNav && (
        <SideNav
          isChatVisible={isChatVisible}
          onToggleChat={() => setIsChatVisible(!isChatVisible)}
          isFileTreeVisible={isFileTreeVisible}
          onToggleFileTree={() => setIsFileTreeVisible(!isFileTreeVisible)}
        />
      )}
      { children }
    </div>
  );
}
