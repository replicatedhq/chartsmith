import React, { useRef, useEffect } from "react";
import type { editor } from "monaco-editor";
import Editor from "@monaco-editor/react";
import type { WorkspaceFile } from "@/lib/types/workspace";
import { useMonacoEditor } from "../../hooks/useMonacoEditor";

interface CodeEditorProps {
  file?: WorkspaceFile;
  theme?: "light" | "dark";
  value?: string;
  onChange?: (value: string | undefined) => void;
}

export function CodeEditor({ file, theme = "light", value, onChange }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { handleEditorInit } = useMonacoEditor(file);

  useEffect(() => {
    if (editorRef.current && value) {
      // Wait for next tick to ensure content is set
      setTimeout(() => {
        editorRef.current?.revealLine(Number.MAX_SAFE_INTEGER);
      }, 0);
    }
  }, [value]);

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    editorRef.current = editor;
    handleEditorInit(editor, monaco);
  };

  return (
    <div className="flex-1 h-full">
      <Editor
        height="100%"
        defaultLanguage="yaml"
        language="yaml"
        value={value ?? ""}
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
        onMount={handleEditorMount}
        key={`${file?.filePath}-${theme}`} // Force re-mount when file or theme changes
      />
    </div>
  );
}
