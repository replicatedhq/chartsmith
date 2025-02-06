import { Message } from "@/components/editor/types";

export interface Workspace {
  id: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  name: string;
  charts: Chart[];
  files: WorkspaceFile[];
  renderedCharts: RenderedChart[];
  currentRevisionNumber: number;
  incompleteRevisionNumber?: number;
  currentPlans: Plan[];
  previousPlans: Plan[];
  messages: Message[];
}

export interface WorkspaceFile {
  id: string;
  filePath: string;  // Required - files without paths are filtered out
  content: string;   // Required but may be empty string
  pendingPatch?: string;
}

export interface Chart {
  id: string;
  name: string;
  files: WorkspaceFile[];
}

export interface RenderedChart {
  id: string;
  name: string;
  scenarios: RenderedChartScenario[];
}

export interface RenderedChartScenario {
  id: string;
  name: string;
  values: string;
  files: WorkspaceFile[];
}

export interface Plan {
  id: string;
  description: string;
  status: string;
  workspaceId: string;
  chatMessageIds: string[];
  createdAt: Date;
  isComplete: boolean;
  actionFiles: ActionFile[];
}

export interface ActionFile {
  action: string;
  path: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  prompt: string;
  response: string;
  createdAt: Date;
  isIntentComplete: boolean;
  intent?: Intent;
}

export interface Intent {
  isConversational: boolean;
  isPlan: boolean;
  isOffTopic: boolean;
  isChartDeveloper: boolean;
  isChartOperator: boolean;
  isProceed: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
  chartId?: string;
  workspaceId?: string;
}

