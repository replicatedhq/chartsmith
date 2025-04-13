import { atom } from 'jotai';

// Define the message type
export interface ChatMessage {
  id: string;
  prompt: string;
  response?: string;
  createdAt: string;
  isComplete?: boolean;
  responseRenderId?: string;
}

// Define render type
export interface Render {
  id: string;
  // Add any other properties that might be in the renders
  [key: string]: any;
}

// Create an atom to store the current workspace ID
export const workspaceIdAtom = atom<string | null>(null);

// Create an atom to store the messages for the current workspace
export const messagesAtom = atom<ChatMessage[]>([]);

// Create an atom to store the renders for the current workspace
export const rendersAtom = atom<Render[]>([]);

// Create an atom to track connection status
export const connectionStatusAtom = atom<string>('disconnected');

// Selectors
export const hasWorkspaceAtom = atom((get) => !!get(workspaceIdAtom));