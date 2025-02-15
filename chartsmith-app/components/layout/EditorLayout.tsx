import React from "react";

// contexts
import { useTheme } from "@/contexts/ThemeContext";

// components
import { TopNav } from "@/components/TopNav";
import { DebugPanel } from "@/components/DebugPanel";
import CommandMenu from "@/components/CommandMenu";

// contexts
import { useCommandMenu } from "@/contexts/CommandMenuContext";

interface EditorLayoutProps {
  children: React.ReactNode;
}

export function EditorLayout({ children }: EditorLayoutProps) {
  const { theme } = useTheme();
  const {
    isCommandMenuOpen,
    setIsCommandMenuOpen,
    isDebugVisible,
    setIsDebugVisible
  } = useCommandMenu();

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
      <div className="flex-none">
        <TopNav />
      </div>
      <div className="flex-1 flex min-h-0 w-full max-w-[100vw] overflow-hidden">
        {children}
        <DebugPanel isVisible={isDebugVisible} />
      </div>
      <CommandMenu
        isOpen={isCommandMenuOpen}
        onClose={() => setIsCommandMenuOpen(false)}
        onToggleDebug={() => {
          setIsDebugVisible(!isDebugVisible);
          setIsCommandMenuOpen(false);
        }}
        isDebugVisible={isDebugVisible}
      />
    </div>
  );
}
