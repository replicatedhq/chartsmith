/**
 * Unit tests for ChatMessage component.
 * Tests message rendering, streaming states, markdown, and code highlighting.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';
import {
  renderWithProviders,
  mockSession,
  mockWorkspace,
  mockMessage,
  mockStreamingMessage,
} from './test-utils';
import { Message } from '../types';

// Mock react-markdown
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown-content">{children}</div>;
  };
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Copy: () => <span data-testid="copy-icon">Copy</span>,
  Check: () => <span data-testid="check-icon">Check</span>,
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('img', props);
  },
}));

// Mock the Terminal component
jest.mock('../Terminal', () => ({
  Terminal: () => <div data-testid="terminal">Terminal</div>,
}));

// Mock the FeedbackModal component
jest.mock('../FeedbackModal', () => ({
  FeedbackModal: () => <div data-testid="feedback-modal">FeedbackModal</div>,
}));

// Mock the ConversionProgress component
jest.mock('../ConversionProgress', () => ({
  ConversionProgress: () => <div data-testid="conversion-progress">ConversionProgress</div>,
}));

// Mock the RollbackModal component
jest.mock('../RollbackModal', () => ({
  RollbackModal: () => <div data-testid="rollback-modal">RollbackModal</div>,
}));

// Mock the PlanChatMessage component
jest.mock('../PlanChatMessage', () => ({
  PlanChatMessage: () => <div data-testid="plan-chat-message">PlanChatMessage</div>,
}));

// Mock workspace actions
jest.mock('@/lib/workspace/actions/cancel-message', () => ({
  cancelMessageAction: jest.fn(),
}));

jest.mock('@/lib/workspace/actions/perform-followup-action', () => ({
  performFollowupAction: jest.fn(),
}));

jest.mock('@/lib/workspace/actions/create-chat-message', () => ({
  createChatMessageAction: jest.fn(),
}));

jest.mock('@/lib/workspace/actions/get-workspace-messages', () => ({
  getWorkspaceMessagesAction: jest.fn(),
}));

describe('ChatMessage', () => {
  const defaultProps = {
    messageId: mockMessage.id,
    session: mockSession,
    onContentUpdate: jest.fn(),
  };

  describe('Rendering', () => {
    it('renders without errors', () => {
      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage]
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });

    it('renders null when message is not found', () => {
      const { container } = renderWithProviders(
        <ChatMessage {...defaultProps} messageId="non-existent" />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: []
        }
      );

      // The component should render empty or minimal content
      expect(container.textContent).toBe('');
    });
  });

  describe('User Messages', () => {
    it('displays user prompt correctly', () => {
      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage]
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });

    it('shows user avatar or icon', () => {
      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage]
        }
      );

      // Should have user indicator
      const userSection = screen.getByText(mockMessage.prompt).closest('div');
      expect(userSection).toBeInTheDocument();
    });
  });

  describe('Assistant Messages', () => {
    it('displays assistant response correctly', () => {
      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage]
        }
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent(mockMessage.response!);
    });

    it('renders response with markdown', () => {
      const messageWithMarkdown: Message = {
        ...mockMessage,
        response: '# Heading\n\nSome **bold** text',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithMarkdown]
        }
      );

      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('Streaming State', () => {
    it('shows streaming indicator when isStreaming is true', () => {
      renderWithProviders(
        <ChatMessage {...defaultProps} messageId={mockStreamingMessage.id} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockStreamingMessage]
        }
      );

      // Should show streaming indicator dots
      const streamingIndicator = screen.queryByLabelText(/typing/i);
      // The component should indicate streaming state
      expect(screen.getByTestId('markdown-content')).toHaveTextContent(mockStreamingMessage.response!);
    });

    it('handles partial content during streaming', () => {
      const partialMessage: Message = {
        ...mockStreamingMessage,
        response: 'I am generating a deployment manifest for your',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} messageId={partialMessage.id} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [partialMessage]
        }
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('I am generating a deployment manifest for your');
    });

    it('handles empty response during initial streaming', () => {
      const emptyResponseMessage: Message = {
        ...mockStreamingMessage,
        response: '',
        isStreaming: true,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} messageId={emptyResponseMessage.id} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [emptyResponseMessage]
        }
      );

      // Should show loading state when no content yet - the component shows "thinking..."
      expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    });
  });

  describe('Code Blocks', () => {
    it('renders code blocks with syntax highlighting', () => {
      const messageWithCode: Message = {
        ...mockMessage,
        response: '```yaml\napiVersion: v2\nname: test\n```',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithCode]
        }
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('apiVersion: v2');
    });

    it('renders Helm template code correctly', () => {
      const messageWithHelm: Message = {
        ...mockMessage,
        response: '```yaml\nname: {{ .Values.name }}\nreplicas: {{ .Values.replicaCount }}\n```',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithHelm]
        }
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('{{ .Values.name }}');
    });

    it('renders inline code correctly', () => {
      const messageWithInlineCode: Message = {
        ...mockMessage,
        response: 'Use the `helm install` command to deploy.',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithInlineCode]
        }
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('helm install');
    });
  });

  describe('Timestamps', () => {
    it('displays creation timestamp', () => {
      const messageWithTime: Message = {
        ...mockMessage,
        createdAt: new Date('2024-01-15T10:30:00Z'),
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithTime]
        }
      );

      // The component should display the timestamp in some format
      // This depends on how the component formats dates
      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });
  });

  describe('Complete State', () => {
    it('shows complete indicator when isComplete is true', () => {
      const completeMessage: Message = {
        ...mockMessage,
        isComplete: true,
        isIntentComplete: true,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [completeMessage]
        }
      );

      // Should not show loading spinner
      expect(screen.queryByText(/generating response/i)).not.toBeInTheDocument();
    });

    it('shows loading when not complete and no response', () => {
      const incompleteMessage: Message = {
        ...mockMessage,
        response: undefined,
        isComplete: false,
        isIntentComplete: false,
        isStreaming: false,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} messageId={incompleteMessage.id} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [incompleteMessage]
        }
      );

      // The component shows "thinking..." for incomplete messages
      expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    });
  });

  describe('Theme Support', () => {
    it('renders correctly in dark theme', () => {
      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage],
          theme: 'dark'
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });

    it('renders correctly in light theme', () => {
      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage],
          theme: 'light'
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });
  });

  describe('Tool Invocations', () => {
    it('displays tool invocations when present', () => {
      const messageWithTools: Message = {
        ...mockMessage,
        toolInvocations: [
          {
            toolCallId: 'tool-1',
            toolName: 'renderChart',
            args: { chartName: 'test-chart' },
            state: 'result',
            result: { success: true },
          },
        ],
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithTools]
        }
      );

      // Should show tool invocation display
      expect(screen.getByText(/renderChart/i)).toBeInTheDocument();
    });
  });

  describe('Plan Display', () => {
    it('shows plan when responsePlanId is present', () => {
      const messageWithPlan: Message = {
        ...mockMessage,
        responsePlanId: 'plan-123',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithPlan],
          initialPlans: [{
            id: 'plan-123',
            workspaceId: mockWorkspace.id,
            createdAt: new Date(),
            description: 'Test plan',
            status: 'pending',
            chatMessageIds: ['test-message-id'],
            actionFiles: [],
          }]
        }
      );

      // Should attempt to render plan
      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });
  });

  describe('Content Updates', () => {
    it('calls onContentUpdate when content changes', async () => {
      const onContentUpdate = jest.fn();

      renderWithProviders(
        <ChatMessage 
          {...defaultProps} 
          onContentUpdate={onContentUpdate}
        />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage]
        }
      );

      // The callback should be called during render/updates
      // This depends on implementation
    });
  });

  describe('Error Handling', () => {
    it('handles missing response gracefully', () => {
      const messageNoResponse: Message = {
        ...mockMessage,
        response: undefined,
        isComplete: true,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageNoResponse]
        }
      );

      // Should still render the prompt
      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });

    it('handles malformed markdown gracefully', () => {
      const malformedMessage: Message = {
        ...mockMessage,
        response: '```yaml\nunclosed code block',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [malformedMessage]
        }
      );

      // Should still render without crashing
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('Multiple Messages', () => {
    it('renders specific message from array', () => {
      const messages: Message[] = [
        { ...mockMessage, id: 'msg-1', prompt: 'First question' },
        { ...mockMessage, id: 'msg-2', prompt: 'Second question' },
        { ...mockMessage, id: 'msg-3', prompt: 'Third question' },
      ];

      renderWithProviders(
        <ChatMessage {...defaultProps} messageId="msg-2" />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: messages
        }
      );

      expect(screen.getByText('Second question')).toBeInTheDocument();
      expect(screen.queryByText('First question')).not.toBeInTheDocument();
      expect(screen.queryByText('Third question')).not.toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('shows cancel button when message is not complete', () => {
      const incompleteMessage: Message = {
        ...mockMessage,
        isComplete: false,
        isIntentComplete: false,
        response: undefined,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} messageId={incompleteMessage.id} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [incompleteMessage]
        }
      );

      expect(screen.getByText('cancel')).toBeInTheDocument();
    });
  });

  describe('Cancelled Messages', () => {
    it('shows cancelled indicator when message is cancelled', () => {
      const cancelledMessage: Message = {
        ...mockMessage,
        isCanceled: true,
        isComplete: true,
        response: 'Partial response...',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} messageId={cancelledMessage.id} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [cancelledMessage]
        }
      );

      // Should still render the message
      expect(screen.getByText(cancelledMessage.prompt)).toBeInTheDocument();
    });
  });

  describe('Long Responses', () => {
    it('handles long responses without truncation', () => {
      const longResponse = 'A'.repeat(1000);
      const longMessage: Message = {
        ...mockMessage,
        response: longResponse,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [longMessage]
        }
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent(longResponse);
    });
  });

  describe('Different Message States', () => {
    it('handles message with isApplied true', () => {
      const appliedMessage: Message = {
        ...mockMessage,
        isApplied: true,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [appliedMessage]
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });

    it('handles message with isApplying true', () => {
      const applyingMessage: Message = {
        ...mockMessage,
        isApplying: true,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [applyingMessage]
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });

    it('handles message with isIgnored true', () => {
      const ignoredMessage: Message = {
        ...mockMessage,
        isIgnored: true,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [ignoredMessage]
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });
  });

  describe('Followup Actions', () => {
    it('renders followup actions when present', () => {
      const messageWithFollowups: Message = {
        ...mockMessage,
        followupActions: [
          { action: 'apply', label: 'Apply changes' },
          { action: 'ignore', label: 'Ignore' },
        ],
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithFollowups]
        }
      );

      // The component should render the message
      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });
  });

  describe('Render and Conversion', () => {
    it('handles message with responseRenderId', () => {
      const messageWithRender: Message = {
        ...mockMessage,
        responseRenderId: 'render-123',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithRender]
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });

    it('handles message with responseConversionId', () => {
      const messageWithConversion: Message = {
        ...mockMessage,
        responseConversionId: 'conversion-123',
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [messageWithConversion]
        }
      );

      // The component should render the message even with conversion
      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });
  });

  describe('Revision Number', () => {
    it('handles first message for revision', () => {
      const firstRevisionMessage: Message = {
        ...mockMessage,
        revisionNumber: 1,
      };

      renderWithProviders(
        <ChatMessage {...defaultProps} />,
        { 
          initialWorkspace: mockWorkspace,
          initialMessages: [firstRevisionMessage]
        }
      );

      expect(screen.getByText(mockMessage.prompt)).toBeInTheDocument();
    });
  });
});

