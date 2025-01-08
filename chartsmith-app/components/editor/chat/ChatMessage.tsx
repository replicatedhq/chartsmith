import React, { useState } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { ChatChanges } from "./ChatChanges";
import { Button } from "@/components/ui/Button";
import { UndoConfirmationModal } from "@/components/UndoConfirmationModal";
import { FeedbackModal } from "@/components/FeedbackModal";

interface ChatMessageProps {
  message: Message;
  onApplyChanges?: () => void;
  session: Session;
  workspaceId: string;
  showActions?: boolean;
}

export function ChatMessage({ message, onApplyChanges, session, workspaceId, showActions = true }: ChatMessageProps) {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);

  return (
    <div className="space-y-2">
      {/* User Message */}
      <div className="px-4 py-2 ml-12">
        <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-primary/20" : "bg-primary/10"} rounded-tr-sm`}>
          <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>You</div>
          <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm`}>{message.prompt}</div>
        </div>
      </div>

      {/* Assistant Message - only show if there's a response */}
      {message.response !== undefined && (
        <div className="px-4 py-2 mr-12">
          <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>ChartSmith</div>
            <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm whitespace-pre-wrap`}>{message.response}</div>
            {message.isComplete && (
              <div className="mt-4 space-y-4 border-t border-gray-700/10 pt-4">
                {message.fileChanges && <ChatChanges changes={message.fileChanges} />}
                {showActions && onApplyChanges && (
                  <div className="flex justify-between mt-4">
                    <Button
                      onClick={() => setShowReportModal(true)}
                      variant="outline"
                      className={`${theme === "dark" ? "border-dark-border hover:bg-dark-border/40" : ""}`}
                    >
                      Give feedback
                    </Button>
                    <Button
                      onClick={() => onApplyChanges()}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      Apply changes
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <FeedbackModal 
        isOpen={showReportModal} 
        onClose={() => setShowReportModal(false)} 
        message={message}
        chatId={message.id}
        workspaceId={workspaceId}
        session={session}
      />
      <UndoConfirmationModal isOpen={showUndoModal} onClose={() => setShowUndoModal(false)} onConfirm={() => onUndo?.()} />
    </div>
  );
}
