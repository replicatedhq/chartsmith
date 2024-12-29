"use client";

import { useRef, useEffect, useCallback } from "react";
import type { editor } from "monaco-editor";
import type { FileNode } from "../components/editor/types";

export function useMonacoEditor(file?: FileNode) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const modelRef = useRef<editor.ITextModel | null>(null);

  const updateDecorations = useCallback(() => {
    if (!editorRef.current || !monacoRef.current || !file) {
      return;
    }

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Clear existing decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);

    // Add new error decorations if needed
    if (file.hasError && file.errorLine !== undefined) {
      const newDecorations = [
        {
          range: new monaco.Range(file.errorLine, 1, file.errorLine, 1000),
          options: {
            isWholeLine: true,
            className: "bg-error/10",
            glyphMarginClassName: "error-glyph",
            linesDecorationsClassName: "error-line",
            minimap: {
              color: { id: "minimap.errorHighlight" },
              position: 1,
            },
            overviewRuler: {
              color: { id: "editorOverviewRuler.errorForeground" },
              position: monaco.editor.OverviewRulerLane.Right,
            },
          },
        },
      ];

      decorationsRef.current = editor.deltaDecorations([], newDecorations);
    }
  }, [file]);

  const handleEditorInit = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Set up model change listener
      editor.onDidChangeModel((e) => {
        if (modelRef.current !== editor.getModel()) {
          modelRef.current = editor.getModel();
          // Update decorations when model changes
          setTimeout(updateDecorations, 0);
        }
      });

      // Initial decoration update
      setTimeout(updateDecorations, 0);
    },
    [updateDecorations],
  );

  // Update decorations when file changes
  useEffect(() => {
    if (editorRef.current) {
      setTimeout(updateDecorations, 0);
    }
  }, [file?.path, file?.errorLine, updateDecorations]);

  return { handleEditorInit };
}
