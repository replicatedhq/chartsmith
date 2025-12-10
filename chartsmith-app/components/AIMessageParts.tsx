'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Component for rendering AI chat messages
 *
 * This component handles rendering of chat messages from the AI SDK.
 * It supports both simple text content and more complex message structures.
 */

interface AIMessagePartsProps {
  content: string;
  role?: 'user' | 'assistant';
}

/**
 * Main component for rendering message content
 */
export function AIMessageParts({ content, role }: AIMessagePartsProps) {
  const { theme } = useTheme();

  if (!content) return null;

  return (
    <div className={`text-[12px] ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
      <div className="markdown-content">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

/**
 * Loading indicator for streaming messages
 */
export function AIMessageLoading() {
  const { theme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
      <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        generating response...
      </div>
    </div>
  );
}

/**
 * Error display for failed messages
 */
export function AIMessageError({ error }: { error: Error }) {
  const { theme } = useTheme();

  return (
    <div
      className={`p-2 rounded border ${
        theme === 'dark'
          ? 'bg-red-900/10 border-red-500/20 text-red-400'
          : 'bg-red-50 border-red-200 text-red-600'
      }`}
    >
      <div className="text-xs font-medium mb-1">Error</div>
      <div className="text-[11px]">{error.message}</div>
    </div>
  );
}

/**
 * Tool invocation display component
 * Can be used when tool calls are visible in the response
 */
interface ToolInvocationDisplayProps {
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status?: 'pending' | 'running' | 'completed' | 'error';
}

export function ToolInvocationDisplay({
  toolName,
  args,
  result,
  status = 'completed',
}: ToolInvocationDisplayProps) {
  const { theme } = useTheme();

  const getToolDisplayName = (name: string): string => {
    const displayNames: Record<string, string> = {
      textEditor: 'File Editor',
      latestKubernetesVersion: 'K8s Version Lookup',
      latestSubchartVersion: 'Subchart Version Lookup',
    };
    return displayNames[name] || name;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <span className="text-yellow-500 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10">
            pending
          </span>
        );
      case 'running':
        return (
          <span className="text-blue-500 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10">
            running
          </span>
        );
      case 'completed':
        return (
          <span className="text-green-500 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10">
            completed
          </span>
        );
      case 'error':
        return (
          <span className="text-red-500 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10">
            error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`my-2 p-2 rounded border ${
        theme === 'dark'
          ? 'bg-dark-border/20 border-dark-border/40'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            {getToolDisplayName(toolName)}
          </span>
          {getStatusBadge()}
        </div>
      </div>

      {/* Tool arguments */}
      {args && Object.keys(args).length > 0 && (
        <div className="mt-1">
          <details className="text-[10px]">
            <summary
              className={`cursor-pointer ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Arguments
            </summary>
            <pre
              className={`mt-1 p-1 rounded text-[9px] overflow-x-auto ${
                theme === 'dark' ? 'bg-dark/50' : 'bg-gray-100'
              }`}
            >
              {JSON.stringify(args, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Tool result */}
      {result !== undefined && status === 'completed' && (
        <div className="mt-1">
          <details className="text-[10px]" open>
            <summary
              className={`cursor-pointer ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Result
            </summary>
            <pre
              className={`mt-1 p-1 rounded text-[9px] overflow-x-auto ${
                theme === 'dark' ? 'bg-dark/50' : 'bg-gray-100'
              }`}
            >
              {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
