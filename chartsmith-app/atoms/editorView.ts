import { atom } from "jotai";
import { FileNode } from "@/components/types";

export type EditorView = "source" | "rendered";

interface ViewState {
  sourceFile?: FileNode;
  renderedFile?: FileNode;
}

export const editorViewAtom = atom<EditorView>("source");

export const editorViewStateAtom = atom<ViewState>({
  sourceFile: undefined,
});

// Convenience atom for updating file selection based on current view
export const updateFileSelectionAtom = atom(
  null,
  (get, set, file: FileNode) => {
    const currentView = get(editorViewAtom);
    set(editorViewStateAtom, (prev) => ({
      ...prev,
      [currentView === "source" ? "sourceFile" : "renderedFile"]: file,
    }));
  }
);
