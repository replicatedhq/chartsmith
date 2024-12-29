import React from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext";

interface ChatActionsProps {
  onUndo: () => void;
  onReport: () => void;
}

export function ChatActions({ onUndo, onReport }: ChatActionsProps) {
  const { theme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button onClick={onUndo} className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 transition-colors ${theme === "dark" ? "bg-dark-border/40 hover:bg-dark-border/60 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>
        <RotateCcw className="w-3.5 h-3.5" />
        Undo Changes
      </button>
      <button onClick={onReport} className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 transition-colors ${theme === "dark" ? "bg-dark-border/40 hover:bg-dark-border/60 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        Report Issue
      </button>
    </div>
  );
}
