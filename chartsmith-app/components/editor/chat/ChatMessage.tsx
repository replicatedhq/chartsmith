import React, { useState } from 'react';
import { Message } from '../types';
import { useTheme } from '../../../contexts/ThemeContext';
import { ChatActions } from './ChatActions';
import { ChatChanges } from './ChatChanges';
import { UndoConfirmationModal } from '@/components/UndoConfirmationModal';
import { ReportIssueModal } from '@/components/ReportIssueModal';

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
      <div className={`px-4 py-2 ${message.role === 'user' ? 'ml-12' : 'mr-12'}`}>
        <div className={`p-4 rounded-2xl ${
          message.role === 'user'
            ? `${theme === 'dark' ? 'bg-primary/20' : 'bg-primary/10'} rounded-tr-sm`
            : `${theme === 'dark' ? 'bg-dark-border/40' : 'bg-gray-100'} rounded-tl-sm`
        }`}>
          <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
            {message.role === 'user' ? 'You' : 'ChartSmith'}
          </div>
          <div className={`${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'} text-sm`}>
            {message.content}
          </div>
          {showActions && (
            <div className="mt-4 space-y-4 border-t border-gray-700/10 pt-4">
              <ChatChanges changes={message.changes} />
              <ChatActions
                onUndo={() => setShowUndoModal(true)}
                onReport={() => setShowReportModal(true)}
              />
            </div>
          )}
        </div>
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
