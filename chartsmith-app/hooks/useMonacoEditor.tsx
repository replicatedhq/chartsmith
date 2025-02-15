"use client";

import { useRef, useEffect, useCallback } from "react";
import type { editor } from "monaco-editor";

// types
import type { WorkspaceFile } from "@/lib/types/workspace";

export function useMonacoEditor(file?: WorkspaceFile) {
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
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);    // Initialize empty decorations array - error handling removed since it's not part of File type
    const newDecorations: editor.IModelDeltaDecoration[] = [];

    decorationsRef.current = editor.deltaDecorations([], newDecorations);
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
  }, [file?.filePath, updateDecorations]);

  return { handleEditorInit };
}
