/**
 * Test utilities for React component testing.
 * Provides wrappers, mocks, and helpers for testing Chat components.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WorkspaceUIProvider } from '@/contexts/WorkspaceUIContext';
import { messagesAtom, workspaceAtom, plansAtom, rendersAtom, conversionsAtom } from '@/atoms/workspace';
import { Workspace, Plan, RenderedWorkspace, Conversion } from '@/lib/types/workspace';
import { Message } from '@/components/types';
import { Session } from '@/lib/types/session';

// Default mock session
export const mockSession: Session = {
  id: 'test-session-id',
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    imageUrl: 'https://example.com/avatar.png',
    createdAt: new Date(),
    isWaitlisted: false,
    settings: {
      automaticallyAcceptPatches: false,
      evalBeforeAccept: false,
    },
  },
  expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
};

// Default mock workspace
export const mockWorkspace: Workspace = {
  id: 'test-workspace-id',
  name: 'Test Workspace',
  createdAt: new Date(),
  lastUpdatedAt: new Date(),
  charts: [
    {
      id: 'test-chart-id',
      name: 'test-chart',
      files: [
        {
          id: 'file-1',
          revisionNumber: 1,
          filePath: 'Chart.yaml',
          content: 'apiVersion: v2\nname: test-chart\nversion: 0.1.0',
        },
        {
          id: 'file-2',
          revisionNumber: 1,
          filePath: 'values.yaml',
          content: 'replicaCount: 1\nimage:\n  repository: nginx',
        },
      ],
    },
  ],
  files: [],
  currentRevisionNumber: 1,
};

// Mock workspace with revision 0 (new chart flow)
export const mockNewChartWorkspace: Workspace = {
  ...mockWorkspace,
  currentRevisionNumber: 0,
  charts: [],
};

// Default mock message
export const mockMessage: Message = {
  id: 'test-message-id',
  prompt: 'Hello, can you help me with my chart?',
  response: 'Of course! I can help you with your Helm chart.',
  isComplete: true,
  isIntentComplete: true,
  isCanceled: false,
  createdAt: new Date(),
  workspaceId: 'test-workspace-id',
};

// Mock streaming message (in progress)
export const mockStreamingMessage: Message = {
  id: 'streaming-message-id',
  prompt: 'Generate a deployment',
  response: 'I am generating...',
  isComplete: false,
  isIntentComplete: false,
  isCanceled: false,
  isStreaming: true,
  createdAt: new Date(),
  workspaceId: 'test-workspace-id',
};

// Mock UIMessage structure for AI SDK v5
export interface MockUIMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
}

// Mock useChat return value (from @ai-sdk/react v5)
export interface MockChatOptions {
  messages?: MockUIMessage[];
  status?: 'idle' | 'streaming' | 'submitted' | 'error';
  error?: Error | undefined;
}

// Helper to create UIMessage from simple content
export function createUIMessage(
  id: string,
  role: 'user' | 'assistant',
  content: string
): MockUIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text: content }],
  };
}

export const createMockChat = (options: MockChatOptions = {}) => ({
  id: 'test-chat-id',
  messages: options.messages ?? [],
  status: options.status ?? 'idle',
  error: options.error ?? undefined,
  setMessages: jest.fn(),
  stop: jest.fn(),
  sendMessage: jest.fn(),
});

// Jotai atom hydration helper
interface HydrateAtomsProps {
  initialValues: Array<[any, any]>;
  children: React.ReactNode;
}

function HydrateAtoms({ initialValues, children }: HydrateAtomsProps) {
  useHydrateAtoms(initialValues);
  return <>{children}</>;
}

// Custom render with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialMessages?: Message[];
  initialWorkspace?: Workspace | null;
  initialPlans?: Plan[];
  initialRenders?: RenderedWorkspace[];
  initialConversions?: Conversion[];
  theme?: 'light' | 'dark';
}

export function renderWithProviders(
  ui: ReactElement,
  {
    initialMessages = [],
    initialWorkspace = mockWorkspace,
    initialPlans = [],
    initialRenders = [],
    initialConversions = [],
    theme = 'dark',
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const initialValues: Array<[any, any]> = [
      [messagesAtom, initialMessages],
      [workspaceAtom, initialWorkspace],
      [plansAtom, initialPlans],
      [rendersAtom, initialRenders],
      [conversionsAtom, initialConversions],
    ];

    return (
      <Provider>
        <HydrateAtoms initialValues={initialValues}>
          <ThemeProvider>
            <WorkspaceUIProvider>
              {children}
            </WorkspaceUIProvider>
          </ThemeProvider>
        </HydrateAtoms>
      </Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Helper to create mock messages array
export function createMockMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `message-${i}`,
    prompt: `User message ${i}`,
    response: `Assistant response ${i}`,
    isComplete: true,
    isIntentComplete: true,
    createdAt: new Date(Date.now() - (count - i) * 60000),
    workspaceId: 'test-workspace-id',
  }));
}

// Helper to wait for async updates
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Re-export testing library utilities
export * from '@testing-library/react';

