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
    setView,
    updateFileSelection,
    viewState,
  };
}
