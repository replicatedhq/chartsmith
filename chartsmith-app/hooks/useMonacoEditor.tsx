"use client";

import { useRef, useEffect, useCallback } from "react";
import type { editor } from "monaco-editor";
import type { FileNode } from "../components/editor/types";

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

export function useMonacoEditor(file?: FileNode) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const modelRef = useRef<editor.ITextModel | null>(null);
  const debouncedUpdateRef = useRef<((...args: any[]) => void) | null>(null);

  // Function to determine minimal edits between old and new content
  const determineEdits = useCallback((oldContent: string, newContent: string): editor.IIdentifiedSingleEditOperation[] => {
    if (!monacoRef.current) return [];
    
    // If content is identical, no edits needed
    if (oldContent === newContent) return [];
    
    // Create a single edit operation that replaces the entire content
    // In a more sophisticated implementation, we could compute actual diffs
    return [{
      range: new monacoRef.current.Range(1, 1, oldContent.split('\n').length + 1, 1),
      text: newContent,
      forceMoveMarkers: true
    }];
  }, []);

  // Function to apply incremental updates
  const applyIncrementalUpdate = useCallback((newContent: string) => {
    if (!editorRef.current || !modelRef.current || !monacoRef.current) return;

    const oldContent = modelRef.current.getValue();
    if (oldContent === newContent) return;

    // Preserve cursor state
    const beforeCursor = editorRef.current.getSelections() || [];
    
    // Determine and apply edits
    const edits = determineEdits(oldContent, newContent);
    if (edits.length > 0) {
      modelRef.current.pushEditOperations(
        beforeCursor,
        edits,
        () => beforeCursor // Preserve cursor position
      );
    }
  }, [determineEdits]);

  // Create debounced update function
  useEffect(() => {
    debouncedUpdateRef.current = debounce(applyIncrementalUpdate, 100);
    
    return () => {
      // Cleanup: ensure any pending debounced updates are cancelled
      if (debouncedUpdateRef.current && 'cancel' in debouncedUpdateRef.current) {
        (debouncedUpdateRef.current as any).cancel?.();
      }
    };
  }, [applyIncrementalUpdate]);

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

  return {
    handleEditorInit,
    applyIncrementalUpdate: debouncedUpdateRef.current || applyIncrementalUpdate
  };
}
