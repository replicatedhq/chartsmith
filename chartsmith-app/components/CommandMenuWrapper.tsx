"use client";

import dynamic from 'next/dynamic';
import { useCommandMenu } from '@/contexts/CommandMenuContext';

const CommandMenu = dynamic(
  () => import('./CommandMenu'),
  { ssr: false }
);

export function CommandMenuWrapper() {
  const { isCommandMenuOpen, setIsCommandMenuOpen, isDebugVisible, setIsDebugVisible } = useCommandMenu();

  return (
    <CommandMenu 
      isOpen={isCommandMenuOpen}
      onClose={() => setIsCommandMenuOpen(false)}
      onToggleDebug={() => setIsDebugVisible(!isDebugVisible)}
      isDebugVisible={isDebugVisible}
    />
  );
}
