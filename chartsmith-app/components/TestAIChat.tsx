/**
 * Test component for PR#6: useChat Hook Implementation
 * 
 * This component can be used to manually test the useAIChat hook
 * before migrating ChatContainer in PR#7.
 * 
 * Usage:
 * 1. Add this component to a test page
 * 2. Provide workspaceId and session props
 */

'use client';

import { useAIChat } from '@/hooks/useAIChat';
import { Session } from '@/lib/types/session';
import { Send, Loader2 } from 'lucide-react';

interface TestAIChatProps {
  workspaceId: string;
  session: Session;
}

export function TestAIChat({ workspaceId, session }: TestAIChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
    selectedRole,
    setSelectedRole,
  } = useAIChat({ workspaceId, session });

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Test AI Chat Hook (PR#6)</h2>
        <div className="text-sm text-gray-600 mb-4">
          Testing useAIChat hook implementation
        </div>
        
        {/* Role Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Role:</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as any)}
            className="px-3 py-1 border rounded"
          >
            <option value="auto">Auto</option>
            <option value="developer">Developer</option>
            <option value="operator">Operator</option>
          </select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {error.message}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 border rounded p-4">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No messages yet. Send a message to test the hook.
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="mb-4">
              {message.prompt && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">User:</div>
                  <div className="bg-blue-50 p-2 rounded">{message.prompt}</div>
                </div>
              )}
              {message.response && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Assistant:</div>
                  <div className="bg-gray-50 p-2 rounded">
                    {message.response}
                    {!message.isComplete && (
                      <span className="inline-block ml-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          rows={3}
          className="flex-1 px-3 py-2 border rounded resize-none"
          disabled={isLoading}
        />
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </button>
          {isLoading && (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Reload
          </button>
        </div>
      </form>

      {/* Debug Info */}
      <div className="mt-4 text-xs text-gray-500">
        <div>Messages: {messages.length}</div>
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
        <div>Role: {selectedRole}</div>
      </div>
    </div>
  );
}

