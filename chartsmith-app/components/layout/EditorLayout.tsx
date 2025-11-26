import React from "react";

// contexts
import { useTheme } from "@/contexts/ThemeContext";

// components
import { TopNav } from "@/components/TopNav";
import { DebugPanel } from "@/components/DebugPanel";

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
    <div className={`h-screen flex flex-col overflow-hidden ${
      theme === "dark" ? "bg-forge-black" : "bg-stone-50"
    }`}>
      {/* Subtle background pattern */}
      <div className={`fixed inset-0 pattern-dots pointer-events-none ${
        theme === "dark" ? "opacity-20" : "opacity-10"
      }`} />

      <div className="flex-none relative z-20">
        <TopNav />
      </div>
      <div className="flex-1 flex min-h-0 w-full max-w-[100vw] overflow-hidden relative z-10">
        {children}
        <DebugPanel isVisible={isDebugVisible} />
      </div>
      {/* CommandMenu is now managed by CommandMenuWrapper */}
    </div>
  );
}
