/**
 * Unit tests for ChatContainer component.
 * Tests the main chat interface including input, submission, loading states, and error handling.
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ChatContainer } from '../ChatContainer';
import {
  renderWithProviders,
  mockSession,
  mockWorkspace,
  mockNewChartWorkspace,
  mockMessage,
  createMockChat,
  createUIMessage,
} from './test-utils';

// Mock the useChat hook
const mockUseChat = createMockChat();

jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn(() => mockUseChat),
}));

jest.mock('ai', () => {
  return {
    DefaultChatTransport: jest.fn().mockImplementation(() => ({})),
  };
});

// Import the mock to modify it in tests
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
const mockedUseChat = useChat as jest.MockedFunction<typeof useChat>;
const mockedDefaultChatTransport = DefaultChatTransport as unknown as jest.Mock;

// Mock ScrollingContent to simplify testing
jest.mock('../ScrollingContent', () => ({
  ScrollingContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-container">{children}</div>
  ),
}));

// Mock ChatMessage component
jest.mock('../ChatMessage', () => ({
  ChatMessage: ({ messageId }: { messageId: string }) => (
    <div data-testid={`chat-message-${messageId}`}>Message: {messageId}</div>
  ),
}));

// Mock NewChartContent component
jest.mock('../NewChartContent', () => ({
  NewChartContent: () => <div data-testid="new-chart-content">New Chart Content</div>,
}));

// Mock ConversationManager component
jest.mock('../ConversationManager', () => ({
  ConversationManager: () => <div data-testid="conversation-manager">Conversation Manager</div>,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  Users: () => <span data-testid="users-icon">Users</span>,
  Code: () => <span data-testid="code-icon">Code</span>,
  User: () => <span data-testid="user-icon">User</span>,
  Sparkles: () => <span data-testid="sparkles-icon">Sparkles</span>,
  Square: () => <span data-testid="square-icon">Square</span>,
  AlertCircle: () => <span data-testid="alert-icon">Alert</span>,
  RefreshCw: () => <span data-testid="refresh-icon">Refresh</span>,
  Clock: () => <span data-testid="clock-icon">Clock</span>,
  MoreVertical: () => <span data-testid="more-icon">More</span>,
  Save: () => <span data-testid="save-icon">Save</span>,
  FolderOpen: () => <span data-testid="folder-icon">Folder</span>,
  Download: () => <span data-testid="download-icon">Download</span>,
  Trash2: () => <span data-testid="trash-icon">Trash</span>,
  Flame: () => <span data-testid="flame-icon">Flame</span>,
  X: () => <span data-testid="x-icon">X</span>,
}));

describe('ChatContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to default state
    mockedUseChat.mockReturnValue(createMockChat() as any);
    mockedDefaultChatTransport.mockClear();
  });

  describe('Rendering', () => {
    it('renders without errors', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByPlaceholderText('Ask a question or request a change...')).toBeInTheDocument();
    });

    it('renders null when workspace is not available', () => {
      const { container } = renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: null }
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders NewChartContent when revision is 0', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockNewChartWorkspace }
      );

      expect(screen.getByTestId('new-chart-content')).toBeInTheDocument();
    });

    it('renders existing messages', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        {
          initialWorkspace: mockWorkspace,
          initialMessages: [mockMessage]
        }
      );

      expect(screen.getByTestId(`chat-message-${mockMessage.id}`)).toBeInTheDocument();
    });
  });

  describe('Input Field', () => {
    it('accepts text input', async () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or request a change...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      // Component manages its own input state now
      expect(textarea).toHaveValue('Hello');
    });
  });

  describe('Form Submission', () => {
    it('submits on Enter key press with input', async () => {
      const mockSendMessage = jest.fn();
      mockedUseChat.mockReturnValue({
        ...createMockChat(),
        sendMessage: mockSendMessage,
      } as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or request a change...');
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('does not submit on Shift+Enter (allows newline)', async () => {
      const mockSendMessage = jest.fn();
      mockedUseChat.mockReturnValue({
        ...createMockChat(),
        sendMessage: mockSendMessage,
      } as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or request a change...');
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('does not submit when input is empty', async () => {
      const mockSendMessage = jest.fn();
      mockedUseChat.mockReturnValue({
        ...createMockChat(),
        sendMessage: mockSendMessage,
      } as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or request a change...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('does not submit when loading (streaming)', async () => {
      const mockSendMessage = jest.fn();
      mockedUseChat.mockReturnValue({
        ...createMockChat({ status: 'streaming' }),
        sendMessage: mockSendMessage,
      } as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or request a change...');
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Send Button', () => {
    it('is disabled when input is empty', () => {
      mockedUseChat.mockReturnValue(createMockChat() as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const sendButton = screen.getByTitle('Send message');
      expect(sendButton).toBeDisabled();
    });

    it('is enabled when input has text', () => {
      mockedUseChat.mockReturnValue(createMockChat() as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or request a change...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      const sendButton = screen.getByTitle('Send message');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when status is streaming', () => {
      mockedUseChat.mockReturnValue(createMockChat({ status: 'streaming' }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('Forging your response...')).toBeInTheDocument();
    });

    it('shows stop button when loading', () => {
      mockedUseChat.mockReturnValue(createMockChat({ status: 'streaming' }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // The stop button is in the loading indicator
      const stopButton = screen.getByTitle('Stop forging');
      expect(stopButton).toBeInTheDocument();
    });

    it('calls stop when stop button is clicked', async () => {
      const mockStop = jest.fn();
      mockedUseChat.mockReturnValue({
        ...createMockChat({ status: 'streaming' }),
        stop: mockStop,
      } as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // Get the stop button and click it
      const stopButton = screen.getByTitle('Stop forging');
      fireEvent.click(stopButton);

      expect(mockStop).toHaveBeenCalled();
    });

    it('shows stop button instead of send button when loading', () => {
      mockedUseChat.mockReturnValue(createMockChat({ status: 'streaming' }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // Stop button should be visible
      const stopButton = screen.getByTitle('Stop forging');
      expect(stopButton).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error occurs', () => {
      const testError = new Error('Test error message');
      mockedUseChat.mockReturnValue(createMockChat({ error: testError }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // The component shows "Something went wrong" for generic errors
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows rate limit error message', () => {
      const rateLimitError = new Error('Rate limit exceeded 429');
      mockedUseChat.mockReturnValue(createMockChat({ error: rateLimitError }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('Forge cooling down')).toBeInTheDocument();
    });

    it('shows network error message', () => {
      const networkError = new Error('Failed to fetch');
      mockedUseChat.mockReturnValue(createMockChat({ error: networkError }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('Connection lost')).toBeInTheDocument();
    });

    it('can dismiss error message', async () => {
      const testError = new Error('Test error');
      mockedUseChat.mockReturnValue(createMockChat({ error: testError }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('shows retry button for retriable errors', () => {
      const networkError = new Error('Failed to fetch');
      mockedUseChat.mockReturnValue(createMockChat({ error: networkError }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('Reheat & retry')).toBeInTheDocument();
    });
  });

  describe('Role Selector', () => {
    it('shows role selector button', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByTitle(/Perspective:/)).toBeInTheDocument();
    });

    it('opens role dropdown on click', async () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const roleButton = screen.getByTitle(/Perspective:/);
      fireEvent.click(roleButton);

      expect(screen.getByText('Auto-detect')).toBeInTheDocument();
      expect(screen.getByText('Chart Developer')).toBeInTheDocument();
      expect(screen.getByText('End User')).toBeInTheDocument();
    });

    it('changes role when option is selected', async () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const roleButton = screen.getByTitle(/Perspective:/);
      fireEvent.click(roleButton);

      const developerOption = screen.getByText('Chart Developer');
      fireEvent.click(developerOption);

      // Dropdown should close and role should be updated
      await waitFor(() => {
        expect(screen.queryByText('Ask questions from...')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown when clicking outside', async () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const roleButton = screen.getByTitle(/Perspective:/);
      fireEvent.click(roleButton);

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Ask questions from...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Workspace Context', () => {
    it('passes workspace context to DefaultChatTransport', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(mockedDefaultChatTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          api: '/api/chat',
          body: expect.objectContaining({
            workspaceId: mockWorkspace.id,
            workspaceName: mockWorkspace.name,
            currentRevision: mockWorkspace.currentRevisionNumber,
          }),
        })
      );
    });

    it('includes chart context in body', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(mockedDefaultChatTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            charts: expect.arrayContaining([
              expect.objectContaining({
                name: 'test-chart',
                files: expect.arrayContaining([
                  expect.objectContaining({ path: 'Chart.yaml' }),
                  expect.objectContaining({ path: 'values.yaml' }),
                ]),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('has accessible textarea', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or request a change...');
      expect(textarea).toBeInTheDocument();
    });

    it('loading indicator has aria-live', () => {
      mockedUseChat.mockReturnValue(createMockChat({ status: 'streaming' }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // The loading state has role="status" with aria-live="polite"
      // There may be multiple status elements, get the first one
      const loadingContainers = screen.getAllByRole('status');
      expect(loadingContainers[0]).toHaveAttribute('aria-live', 'polite');
    });

    it('error message has alert role', () => {
      const testError = new Error('Test error');
      mockedUseChat.mockReturnValue(createMockChat({ error: testError }) as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const errorContainer = screen.getByRole('alert');
      expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Message Syncing', () => {
    it('syncs streaming messages to Jotai messagesAtom', () => {
      const streamMessages = [
        createUIMessage('user-1', 'user', 'Hello'),
        createUIMessage('assistant-1', 'assistant', 'Hi there!'),
      ];

      mockedUseChat.mockReturnValue({
        ...createMockChat({ messages: streamMessages }),
      } as any);

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // The component should render messages from the synced atom
      expect(screen.getByTestId('chat-message-user-1')).toBeInTheDocument();
    });
  });
});
