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



