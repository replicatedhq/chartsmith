import React, { memo, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { FileNode } from "./types";
import { useMonacoEditor } from "../../hooks/useMonacoEditor";

interface CodeEditorProps {
  file?: FileNode;
  theme?: "light" | "dark";
  value?: string;
  onChange?: (value: string | undefined) => void;
}

export const CodeEditor = memo(function CodeEditor({ file, theme = "light", value, onChange }: CodeEditorProps) {
  const { handleEditorInit, applyIncrementalUpdate } = useMonacoEditor(file);
  const prevValueRef = useRef(value);

  // Handle external value changes using incremental updates
  useEffect(() => {
    if (value !== prevValueRef.current && applyIncrementalUpdate) {
      applyIncrementalUpdate(value ?? "");
      prevValueRef.current = value;
    }
  }, [value, applyIncrementalUpdate]);

  return (
    <div className="flex-1 h-full">
      <Editor
        height="100%"
        defaultLanguage="yaml"
        language="yaml"
        defaultValue={value ?? ""}
        onChange={onChange}
        theme={theme === "light" ? "vs" : "vs-dark"}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          readOnly: !onChange,
          glyphMargin: true,
          lineDecorationsWidth: 5,
          renderLineHighlight: "all",
          folding: true,
          wordWrap: "on",
          wrappingIndent: "indent",
          fixedOverflowWidgets: true,
          overviewRulerBorder: false,
          overviewRulerLanes: 2,
          hideCursorInOverviewRuler: true,
        }}
        onMount={handleEditorInit}
        // Removed key prop to prevent unnecessary remounts
        // The editor should handle file/theme changes internally
      />
    </div>
  );
});
