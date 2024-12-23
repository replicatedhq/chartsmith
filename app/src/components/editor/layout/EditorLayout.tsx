import React from 'react';
import { TopNav } from '../../layout/TopNav';
import { useTheme } from '../../../contexts/ThemeContext';

interface EditorLayoutProps {
  children: React.ReactNode;
}

export function EditorLayout({ children }: EditorLayoutProps) {
  const { theme } = useTheme();

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
      <TopNav />
      <div className="flex-1 flex min-h-0">
        {children}
      </div>
    </div>
  );
}