import React from 'react';
import { Loader2 } from 'lucide-react';

export type Status = 'success' | 'warning' | 'error' | 'loading';

interface StatusIndicatorProps {
  status: Status;
  className?: string;
}

export function StatusIndicator({ status, className = '' }: StatusIndicatorProps) {
  if (status === 'loading') {
    return <Loader2 className="w-2 h-2 animate-spin text-gray-400" />;
  }

  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-error',
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]} ${className}`} />
  );
}
