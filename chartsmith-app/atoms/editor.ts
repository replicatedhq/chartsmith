import { WorkspaceFile } from '@/lib/types/workspace'
import { atom } from 'jotai'

// Base atoms
export const editorContentAtom = atom<string>("")
export const selectedFileAtom = atom<WorkspaceFile | undefined>(undefined)
export const editorViewAtom = atom<string>("source")

