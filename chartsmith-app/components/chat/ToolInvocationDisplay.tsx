"use client";

import { memo } from "react";
import { ToolInvocation } from "@/components/types";

interface ToolInvocationDisplayProps {
  tool: ToolInvocation;
  theme: string;
}

/**
 * Tool invocation display component.
 * Shows the status of AI tool calls with accessible status indicators.
 */
export const ToolInvocationDisplay = memo(function ToolInvocationDisplay({
  tool,
  theme
}: ToolInvocationDisplayProps) {
  const getStateColor = (state: string) => {
    switch (state) {
      case 'result':
        return theme === 'dark' ? 'text-green-400' : 'text-green-600';
      case 'call':
        return theme === 'dark' ? 'text-blue-400' : 'text-blue-600';
      case 'partial-call':
        return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'result':
        return 'completed';
      case 'call':
        return 'running';
      case 'partial-call':
        return 'preparing';
      default:
        return state;
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
        theme === 'dark' ? 'bg-dark-border/30' : 'bg-gray-50'
      }`}
      role="status"
      aria-label={`Tool ${tool.toolName}: ${getStateLabel(tool.state)}`}
    >
      <span className="flex-shrink-0" aria-hidden="true">🔧</span>
      <span className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
        {tool.toolName}
      </span>
      <span
        className={`ml-auto ${getStateColor(tool.state)}`}
        aria-hidden="true"
      >
        {getStateLabel(tool.state)}
      </span>
    </div>
  );
});
