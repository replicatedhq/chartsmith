import { atom } from 'jotai'
import type { Workspace, Plan, RenderedWorkspace } from '@/lib/types/workspace'
import { Message } from '@/components/types'

// Base atoms
export const workspaceAtom = atom<Workspace | null>(null)

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

export const filesWithPendingPatchesAtom = atom(get => {
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



