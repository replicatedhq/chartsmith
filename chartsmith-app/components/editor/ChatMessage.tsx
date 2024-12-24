import React, { useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Message } from './types';
import { ReportIssueModal } from '../ReportIssueModal';
import { UndoConfirmationModal } from '../UndoConfirmationModal';

interface ChatMessageProps {
  message: Message;
  onUndo?: () => void;
}

export function ChatMessage({ message, onUndo }: ChatMessageProps) {
  const { theme } = useTheme();
  const isAssistant = message.role === 'assistant';
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);

  return (
    <>
      <div className={`p-4 rounded-lg ${
        message.role === 'user'
          ? `${theme === 'dark' ? 'bg-dark-border/40' : 'bg-gray-100'} ml-8`
          : `${theme === 'dark' ? 'bg-dark-border/20' : 'bg-gray-50'} mr-8`
      }`}>
        <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
          {message.role === 'user' ? 'You' : 'ChartSmith'}
        </div>
        <div className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
          {message.content}
        </div>
        {isAssistant && message.changes && (
          <div className="mt-4 space-y-4">
            <div className={`p-3 rounded ${
              theme === 'dark' ? 'bg-dark/40' : 'bg-gray-100'
            }`}>
              <div className={`text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Changes Made:
              </div>
              <div className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {message.changes}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUndoModal(true)}
                className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 transition-colors ${
                  theme === 'dark'
                    ? 'bg-dark-border/40 hover:bg-dark-border/60 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo Changes
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 transition-colors ${
                  theme === 'dark'
                    ? 'bg-dark-border/40 hover:bg-dark-border/60 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Report Issue
              </button>
            </div>
          </div>
        )}
      </div>

      <ReportIssueModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        message={message}
      />

      <UndoConfirmationModal
        isOpen={showUndoModal}
        onClose={() => setShowUndoModal(false)}
        onConfirm={() => onUndo?.()}
      />
    </>
  );
}
