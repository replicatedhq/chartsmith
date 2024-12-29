import React from "react";
import { useTheme } from "../../../contexts/ThemeContext";
import { TopNav } from "@/components/TopNav";

interface EditorLayoutProps {
  children: React.ReactNode;
}

export function EditorLayout({ children }: EditorLayoutProps) {
  const { theme } = useTheme();

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
      <div className="flex-none">
        <TopNav />
      </div>
      <div className="flex-1 flex min-h-0 w-full">{children}</div>
    </div>
  );
}
