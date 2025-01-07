import React, { memo } from "react";
import { Code, FileJson } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { EditorView } from "../../hooks/useEditorView";

interface EditorNavProps {
  view: EditorView;
  onViewChange: () => void;
}

export const EditorNav = memo(function EditorNav({ view, onViewChange }: EditorNavProps) {
  const { theme } = useTheme();

  return (
    <div className={`h-12 min-h-[48px] border-b flex items-center px-4 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex rounded-lg border overflow-hidden">
        <button
          onClick={onViewChange}
          className={`h-8 px-3 flex items-center gap-2 text-sm transition-colors ${view === "source" ? (theme === "dark" ? "bg-dark-border/60 text-white" : "bg-gray-100 text-gray-900") : theme === "dark" ? "bg-transparent text-gray-400 hover:text-white" : "bg-transparent text-gray-600 hover:text-gray-900"}`}
        >
          <Code className="w-4 h-4" />
          Source Code
        </button>
        <button
          onClick={onViewChange}
          className={`h-8 px-3 flex items-center gap-2 text-sm transition-colors ${view === "rendered" ? (theme === "dark" ? "bg-dark-border/60 text-white" : "bg-gray-100 text-gray-900") : theme === "dark" ? "bg-transparent text-gray-400 hover:text-white" : "bg-transparent text-gray-600 hover:text-gray-900"}`}
        >
          <FileJson className="w-4 h-4" />
          Rendered YAML
        </button>
      </div>
    </div>
  );
});
