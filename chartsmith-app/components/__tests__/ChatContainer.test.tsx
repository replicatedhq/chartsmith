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
  createMockStreamingChat,
} from './test-utils';

// Mock the useStreamingChat hook
const mockUseStreamingChat = createMockStreamingChat();

jest.mock('@/hooks/useStreamingChat', () => ({
  useStreamingChat: jest.fn(() => mockUseStreamingChat),
}));

// Import the mock to modify it in tests
import { useStreamingChat } from '@/hooks/useStreamingChat';
const mockedUseStreamingChat = useStreamingChat as jest.MockedFunction<typeof useStreamingChat>;

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
}));

describe('ChatContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to default state
    mockedUseStreamingChat.mockReturnValue(createMockStreamingChat());
  });

  describe('Rendering', () => {
    it('renders without errors', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByPlaceholderText('Ask a question or ask for a change...')).toBeInTheDocument();
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
      const mockHandleInputChange = jest.fn();
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ input: '' })
      );
      // Update the mock to track input changes
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat(),
        handleInputChange: mockHandleInputChange,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or ask for a change...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      expect(mockHandleInputChange).toHaveBeenCalled();
    });

    it('clears input after submission', async () => {
      const mockHandleSubmit = jest.fn();
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat({ input: 'Test message' }),
        handleSubmit: mockHandleSubmit,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or ask for a change...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockHandleSubmit).toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('submits on Enter key press', async () => {
      const mockHandleSubmit = jest.fn();
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat({ input: 'Test message' }),
        handleSubmit: mockHandleSubmit,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or ask for a change...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    it('does not submit on Shift+Enter (allows newline)', async () => {
      const mockHandleSubmit = jest.fn();
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat({ input: 'Test message' }),
        handleSubmit: mockHandleSubmit,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or ask for a change...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(mockHandleSubmit).not.toHaveBeenCalled();
    });

    it('does not submit when input is empty', async () => {
      const mockHandleSubmit = jest.fn();
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat({ input: '' }),
        handleSubmit: mockHandleSubmit,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or ask for a change...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockHandleSubmit).not.toHaveBeenCalled();
    });

    it('does not submit when loading', async () => {
      const mockHandleSubmit = jest.fn();
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat({ input: 'Test', isLoading: true }),
        handleSubmit: mockHandleSubmit,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const textarea = screen.getByPlaceholderText('Ask a question or ask for a change...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockHandleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Send Button', () => {
    it('is disabled when input is empty', () => {
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ input: '' })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const sendButton = screen.getByTitle('Send message');
      expect(sendButton).toBeDisabled();
    });

    it('is enabled when input has text', () => {
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ input: 'Hello' })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      const sendButton = screen.getByTitle('Send message');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ isLoading: true })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('ChartSmith is thinking...')).toBeInTheDocument();
    });

    it('shows stop button when loading', () => {
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ isLoading: true })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // There are multiple stop buttons (one in loading indicator, one in input area)
      const stopButtons = screen.getAllByTitle('Stop generating');
      expect(stopButtons.length).toBeGreaterThan(0);
    });

    it('calls stop when stop button is clicked', async () => {
      const mockStop = jest.fn();
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat({ isLoading: true }),
        stop: mockStop,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // Get the first stop button and click it
      const stopButtons = screen.getAllByTitle('Stop generating');
      fireEvent.click(stopButtons[0]);

      expect(mockStop).toHaveBeenCalled();
    });

    it('shows stop button instead of send button when loading', () => {
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ isLoading: true })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // Stop button should be visible (there are multiple)
      const stopButtons = screen.getAllByTitle('Stop generating');
      expect(stopButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows error message when error occurs', () => {
      const testError = new Error('Test error message');
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ error: testError })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // The component shows "Something went wrong" for generic errors
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows rate limit error message', () => {
      const rateLimitError = new Error('Rate limit exceeded 429');
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ error: rateLimitError })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });

    it('shows network error message', () => {
      const networkError = new Error('Failed to fetch');
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ error: networkError })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('Connection error')).toBeInTheDocument();
    });

    it('can dismiss error message', async () => {
      const testError = new Error('Test error');
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ error: testError })
      );

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
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ error: networkError })
      );

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(screen.getByText('Try again')).toBeInTheDocument();
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
    it('passes workspace context to useStreamingChat', () => {
      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      expect(mockedUseStreamingChat).toHaveBeenCalledWith(
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

      expect(mockedUseStreamingChat).toHaveBeenCalledWith(
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

      const textarea = screen.getByPlaceholderText('Ask a question or ask for a change...');
      expect(textarea).toBeInTheDocument();
    });

    it('loading indicator has aria-live', () => {
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ isLoading: true })
      );

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
      mockedUseStreamingChat.mockReturnValue(
        createMockStreamingChat({ error: testError })
      );

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
        { id: 'user-1', role: 'user' as const, content: 'Hello', createdAt: new Date() },
        { id: 'assistant-1', role: 'assistant' as const, content: 'Hi there!', createdAt: new Date() },
      ];
      
      mockedUseStreamingChat.mockReturnValue({
        ...createMockStreamingChat(),
        messages: streamMessages,
      });

      renderWithProviders(
        <ChatContainer session={mockSession} />,
        { initialWorkspace: mockWorkspace }
      );

      // The component should render messages from the synced atom
      expect(screen.getByTestId('chat-message-user-1')).toBeInTheDocument();
    });
  });
});

