/**
 * Types for LLM parsing and plan management.
 * Ported from pkg/llm/types/types.go
 */

export type ActionPlanStatus = 'pending' | 'creating' | 'created';

export interface ActionPlan {
  type: string;
  action: 'create' | 'update' | 'delete';
  status?: ActionPlanStatus;
}

export interface ActionPlanWithPath extends ActionPlan {
  path: string;
}

export interface Artifact {
  path: string;
  content: string;
}

export interface HelmResponse {
  title: string;
  actions: Record<string, ActionPlan>;
  artifacts: Artifact[];
}
