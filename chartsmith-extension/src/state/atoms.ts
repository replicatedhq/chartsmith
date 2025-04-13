import { atom } from 'jotai';

// Define the message type
export interface ChatMessage {
  id: string;
  prompt: string;
  response?: string;
  createdAt: string;
  isComplete?: boolean;
  responseRenderId?: string;
  responsePlanId?: string;
}

// Define render type
export interface Render {
  id: string;
  charts: RenderedChart[];
  isAutorender: boolean;
}

export interface RenderedChart {
  id: string;
  chartId: string;
  chartName: string;
  isSuccess: boolean;
  depUpdateCommand?: string;
  depUpdateStdout?: string;
  depUpdateStderr?: string;
  helmTemplateCommand?: string;
  helmTemplateStdout?: string;
  helmTemplateStderr?: string;
  createdAt: Date;
  completedAt?: Date;
  renderedFiles: RenderedFile[];
}

export interface RenderedFile {
  id: string;
  filePath: string;
  renderedContent: string;
}

// Define plan types
export interface Plan {
  id: string;
  description: string;
  status: string;
  workspaceId: string;
  chatMessageIds: string[];
  createdAt: Date;
  proceedAt?: Date;
  actionFiles: ActionFile[];
}

export interface ActionFile {
  action: string;
  path: string;
  status: string;
}


// Create an atom to store the current workspace ID
export const workspaceIdAtom = atom<string | null>(null);

// Create an atom to store the messages for the current workspace
export const messagesAtom = atom<ChatMessage[]>([]);

// Create an atom to store the renders for the current workspace
export const rendersAtom = atom<Render[]>([]);

// Create an atom to store the plans for the current workspace
export const plansAtom = atom<Plan[]>([]);

// Create an atom to track connection status
export const connectionStatusAtom = atom<string>('disconnected');

// Selectors
export const hasWorkspaceAtom = atom((get) => !!get(workspaceIdAtom));