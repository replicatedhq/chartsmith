import { WorkspaceFile } from '@/lib/types/workspace'
import { atom } from 'jotai'

// Base atoms
export const editorContentAtom = atom<string>("")
export const selectedFileAtom = atom<WorkspaceFile | undefined>(undefined)
export const editorViewAtom = atom<string>("source")

// Navigation atoms for files with diffs
export const currentDiffIndexAtom = atom<number>(0)

// Derived atom to update the current diff index when selected file changes
export const updateCurrentDiffIndexAtom = atom(
  null,
  (get, set, filesWithDiffs: WorkspaceFile[]) => {
    const selectedFile = get(selectedFileAtom);
    if (selectedFile && filesWithDiffs.length > 0) {
      const index = filesWithDiffs.findIndex(f => f.id === selectedFile.id);
      if (index !== -1) {
        set(currentDiffIndexAtom, index);
      }
    }
  }
)

// New atom to handle file updates after accepting/rejecting patches
export const updateFileContentAtom = atom(
  null,
  (get, set, updatedFile: WorkspaceFile) => {
    const selectedFile = get(selectedFileAtom);
    if (selectedFile?.id === updatedFile.id) {
      set(selectedFileAtom, updatedFile);
      set(editorContentAtom, updatedFile.content);
    }
  }
)
