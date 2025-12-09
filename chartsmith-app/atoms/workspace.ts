import { atom } from 'jotai'
import type { Workspace, Plan, RenderedWorkspace, Chart, WorkspaceFile, Conversion, ConversionFile, ConversionStatus } from '@/lib/types/workspace'
import { Message, FileNode, ChatMessage } from '@/components/types'

// Base atoms
export const workspaceAtom = atom<Workspace | null>(null)
export const editorContentAtom = atom<string>("")
export const selectedFileAtom = atom<WorkspaceFile | undefined>(undefined)

// Legacy messages atom (for non-AI SDK path)
export const messagesAtom = atom<Message[]>([])
export const messageByIdAtom = atom(get => {
  const messages = get(messagesAtom)
  return (id: string) => messages.find(m => m.id === id)
})

// AI SDK messages atom (UIMessage format) - managed by useChat hook, this is just for reference
export const chatMessagesAtom = atom<ChatMessage[]>([])
export const chatMessageByIdAtom = atom(get => {
  const messages = get(chatMessagesAtom)
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

// New atom to get renders for a specific revision number
export const rendersByRevisionAtom = atom(get => {
  const renders = get(rendersAtom)
  return (revisionNumber: number) => renders.filter(r => r.revisionNumber === revisionNumber)
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

export const chartsBeforeApplyingContentPendingAtom = atom<Chart[]>([])
export const looseFilesBeforeApplyingContentPendingAtom = atom<WorkspaceFile[]>([])

export const allFilesBeforeApplyingContentPendingAtom = atom(get => {
  const charts = get(chartsBeforeApplyingContentPendingAtom)
  const chartFilesBeforeApplyingContentPending = charts.flatMap(c => c.files.filter(f => f.contentPending && f.contentPending.length > 0))
  const looseFilesBeforeApplyingContentPending = get(looseFilesBeforeApplyingContentPendingAtom)
  return [...chartFilesBeforeApplyingContentPending, ...looseFilesBeforeApplyingContentPending]
})

export const allFilesWithContentPendingAtom = atom(get => {
  const files = get(looseFilesAtom)
  const filesWithContentPending = files.filter(f => f.contentPending && f.contentPending.length > 0)

  // find files in charts with pending patches too
  const charts = get(chartsAtom)
  const chartsWithContentPending = charts.filter(c => c.files.some(f => f.contentPending && f.contentPending.length > 0))
  // get the files with pending patches from each of the charts with pending patches
  const filesWithContentPendingFromCharts = chartsWithContentPending.flatMap(c =>
    c.files.filter(f => f.contentPending && f.contentPending.length > 0))

  return [...filesWithContentPending, ...filesWithContentPendingFromCharts]
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
export const allFilesBeforeApplyingContentPendingWritableAtom = atom(
  get => get(allFilesBeforeApplyingContentPendingAtom),
  (get, set, newFiles: WorkspaceFile[]) => {
    // This is a writable version that we can use
    set(looseFilesBeforeApplyingContentPendingAtom, newFiles);
    // Note: We would need to update charts too if needed
  }
);

export const addFileToWorkspaceAtom = atom(
  null,
  (get, set, newFile: WorkspaceFile) => {
    const workspace = get(workspaceAtom);
    if (!workspace) return;

    // Update looseFilesBeforeApplyingContentPending directly
    set(looseFilesBeforeApplyingContentPendingAtom, prev => [...prev, newFile]);
  }
);

// Atom for getting rendered files for a specific revision
export const renderedFilesByRevisionAtom = atom(get => {
  const renders = get(rendersAtom);

  return (revisionNumber: number) => {
    // Filter renders by the specified revision
    const revisionRenders = renders.filter(render => render.revisionNumber === revisionNumber);

    return revisionRenders.flatMap(render =>
      render.charts.flatMap(chart =>
        chart.renderedFiles || []
      )
    );
  };
});

// Derived atom for getting all rendered files for the current revision
export const renderedFilesAtom = atom(get => {
  const workspace = get(workspaceAtom);
  const getRenderedFilesByRevision = get(renderedFilesByRevisionAtom);
  const allRenders = get(rendersAtom);

  if (!workspace) return [];

  // Get rendered files for the current revision
  return getRenderedFilesByRevision(workspace.currentRevisionNumber);
});

// Atom to track active renders
export const activeRenderIdsAtom = atom<string[]>([]);

// Atom to track if rendering is in progress
export const isRenderingAtom = atom(
  get => get(activeRenderIdsAtom).length > 0
);
