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
