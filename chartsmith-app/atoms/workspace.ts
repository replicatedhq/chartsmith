import { atom } from 'jotai'
import type { Workspace, Plan, RenderedWorkspace, Chart, WorkspaceFile, Conversion, ConversionFile, ConversionStatus } from '@/lib/types/workspace'
import { Message, FileNode } from '@/components/types'

// Base atoms
export const workspaceAtom = atom<Workspace | null>(null)
export const editorContentAtom = atom<string>("")
export const selectedFileAtom = atom<WorkspaceFile | undefined>(undefined)

export const messagesAtom = atom<Message[]>([])
export const messageByIdAtom = atom(get => {
  const messages = get(messagesAtom)
  return (id: string) => messages.find(m => m.id === id)
})

export const plansAtom = atom<Plan[]>([])
export const planByIdAtom = atom(get => {
  const plans = get(plansAtom)
  return (id: string) => plans.find(p => p.id === id)
})

export const rendersAtom = atom<RenderedWorkspace[]>([])
export const renderByIdAtom = atom(get => {
  const renders = get(rendersAtom)
  return (id: string) => renders.find(r => r.id === id)
})

export const conversionsAtom = atom<Conversion[]>([])
export const conversionByIdAtom = atom(get => {
  const conversions = get(conversionsAtom)
  return (id: string) => conversions.find(c => c.id === id)
})

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

// Derived atoms
export const looseFilesAtom = atom(get => {
  const workspace = get(workspaceAtom)
  if (!workspace) return []
  return workspace.files;
})

export const chartsAtom = atom(get => {
  const workspace = get(workspaceAtom)
  if (!workspace) return []
  return workspace.charts
})

export const chartsBeforeApplyingPendingPatchesAtom = atom<Chart[]>([])
export const looseFilesBeforeApplyingPendingPatchesAtom = atom<WorkspaceFile[]>([])

export const allFilesBeforeApplyingPendingPatchesAtom = atom(get => {
  const charts = get(chartsBeforeApplyingPendingPatchesAtom)
  const chartFilesBeforeApplyingPendingPatches = charts.flatMap(c => c.files.filter(f => f.pendingPatch))
  const looseFilesBeforeApplyingPendingPatches = get(looseFilesBeforeApplyingPendingPatchesAtom)
  return [...chartFilesBeforeApplyingPendingPatches, ...looseFilesBeforeApplyingPendingPatches]
})

export const allFilesWithPendingPatchesAtom = atom(get => {
  const files = get(looseFilesAtom)
  const filesWithPendingPatches = files.filter(f => f.pendingPatch)

  // find files in charts with pending patches too
  const charts = get(chartsAtom)
  const chartsWithPendingPatches = charts.filter(c => c.files.some(f => f.pendingPatch))
  // get the files with pending patches from each of the charts with pending patches
  const filesWithPendingPatchesFromCharts = chartsWithPendingPatches.flatMap(c => c.files.filter(f => f.pendingPatch))

  return [...filesWithPendingPatches, ...filesWithPendingPatchesFromCharts]
})

// Handle plan updated, will update the plan if its found, otherwise it will add it to the list
export const handlePlanUpdatedAtom = atom(
  null,
  (get, set, plan: Plan) => {
    const plans = get(plansAtom)
    const existingPlan = plans.find(p => p.id === plan.id)

    if (existingPlan) {
      // Update existing plan
      const updatedPlans = plans.map(p => p.id === plan.id ? plan : p)
      set(plansAtom, updatedPlans)
    } else {
      // Add new plan
      set(plansAtom, [...plans, plan])
    }
  }
)

// Handle conversion updated, will update the conversion if its found, otherwise it will add it to the list
export const handleConversionUpdatedAtom = atom(
  null,
  (get, set, conversion: Conversion) => {
    const conversions = get(conversionsAtom)
    const existingConversion = conversions.find(c => c.id === conversion.id)

    if (existingConversion) {
      // Update existing conversion
      const updatedConversions = conversions.map(c => c.id === conversion.id ? conversion : c)
      set(conversionsAtom, updatedConversions)
    } else {
      // Add new conversion
      set(conversionsAtom, [...conversions, conversion])
    }
  }
)

export const handleConversionFileUpdatedAtom = atom(
  null,
  (get, set, conversionId: string, conversionFile: ConversionFile) => {
    const conversions = get(conversionsAtom)
    const conversion = conversions.find(c => c.id === conversionId)
    if (!conversion) {
      return;
    }

    const existingFile = conversion.sourceFiles.find(f => f.id === conversionFile.id);

    const updatedConversion = {
      ...conversion,
      sourceFiles: conversion.sourceFiles.map(f => {
        if (f.id === conversionFile.id) {
          const updated = {
            ...f,
            content: conversionFile.content,
            status: conversionFile.status,
            filePath: conversionFile.filePath
          };
          return updated;
        }
        return f;
      })
    }

    set(conversionsAtom, conversions.map(c =>
      c.id === conversionId ? updatedConversion : c
    ))
  }
)

// Helper to determine overall conversion status based on file status
function determineConversionStatus(currentStatus: ConversionStatus, status: string) {
  // Add logic to determine if status should change based on file progress
  return currentStatus;
}

// Create a writable version of the atoms we need to update
export const allFilesBeforeApplyingPendingPatchesWritableAtom = atom(
  get => get(allFilesBeforeApplyingPendingPatchesAtom),
  (get, set, newFiles: WorkspaceFile[]) => {
    // This is a writable version that we can use
    set(looseFilesBeforeApplyingPendingPatchesAtom, newFiles);
    // Note: We would need to update charts too if needed
  }
);

export const addFileToWorkspaceAtom = atom(
  null,
  (get, set, newFile: WorkspaceFile) => {
    const workspace = get(workspaceAtom);
    if (!workspace) return;

    // Update looseFilesBeforeApplyingPendingPatches directly
    set(looseFilesBeforeApplyingPendingPatchesAtom, prev => [...prev, newFile]);

    // Update allFilesWithPendingPatches if needed
    if (newFile.pendingPatch) {
      // This is already a derived atom, so we don't need to update it directly
      // It will update based on the changes to looseFilesBeforeApplyingPendingPatchesAtom
    }
  }
);
