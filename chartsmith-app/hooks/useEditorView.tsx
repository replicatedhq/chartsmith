"use client";

import { FileNode } from "@/components/editor/types";
import { useState, useCallback } from "react";

export type EditorView = "source" | "rendered";

interface ViewState {
  sourceFile?: FileNode;
  renderedFile?: FileNode;
}

export function useEditorView(initialView: EditorView = "source", defaultFile?: FileNode) {
  const [view, setView] = useState<EditorView>(initialView);
  const [viewState, setViewState] = useState<ViewState>(() => ({
    sourceFile: defaultFile,
  }));

  const toggleView = useCallback(
    (files: FileNode[]) => {
      setView((prev) => {
        const newView = prev === "source" ? "rendered" : "source";
        // If no file is selected for the new view, select the first available file
        if (!viewState[`${newView}File`] && files.length > 0) {
          setViewState((prev) => ({
            ...prev,
            [`${newView}File`]: files[0],
          }));
        }
        return newView;
      });
    },
    [viewState],
  );

  const updateFileSelection = useCallback(
    (file: FileNode) => {
      setViewState((prev) => ({
        ...prev,
        [view === "source" ? "sourceFile" : "renderedFile"]: file,
      }));
    },
    [view],
  );

  return {
    view,
    toggleView,
    updateFileSelection,
    viewState,
  };
}
