import React, { useState } from 'react';
import { Message } from '../types';
import { useTheme } from '../../../contexts/ThemeContext';
import { ChatActions } from './ChatActions';
import { ChatChanges } from './ChatChanges';
import { ReportIssueModal } from '@/components/ReportIssueModal';
import { UndoConfirmationModal } from '@/components/UndoConfirmationModal';

interface ChatMessageProps {
  message: Message;
  isLastAssistantMessage: boolean;
  onUndo?: () => void;
}

export function ChatMessage({ message, isLastAssistantMessage, onUndo }: ChatMessageProps) {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);

  const showActions = message.role === 'assistant' && message.changes && isLastAssistantMessage;

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
        {showActions && (
          <div className="mt-4 space-y-4">
            <ChatChanges changes={message.changes} />
            <ChatActions
              onUndo={() => setShowUndoModal(true)}
              onReport={() => setShowReportModal(true)}
            />
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
