import React, { useState } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { ChatChanges } from "./ChatChanges";
import { Button } from "@/components/ui/Button";
import { UndoConfirmationModal } from "@/components/UndoConfirmationModal";
import { FeedbackModal } from "@/components/FeedbackModal";
import { MessageSquarePlus, Check } from "lucide-react";

interface ChatMessageProps {
  message: Message;
  onUndo?: () => void;
  session: Session;
  workspaceId: string;
}

export function ChatMessage({ message, onUndo, session, workspaceId }: ChatMessageProps) {
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
            <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm whitespace-pre-wrap`}>{message.response}</div>                {message.isComplete && (
                  <div className="mt-4 space-y-4 border-t border-gray-700/10 pt-4">
                    {message.fileChanges && <ChatChanges changes={message.fileChanges} />}
                    {onUndo && (
                      <div className="flex items-center justify-between mt-4">
                        <button
                          onClick={() => setShowReportModal(true)}
                          className={`text-sm flex items-center gap-1.5 ${theme === "dark" ? "text-gray-400 hover:text-gray-300" : "text-gray-600 hover:text-gray-900"}`}
                        >
                          <MessageSquarePlus className="w-4 h-4" />
                          Feedback?
                        </button>
                        <Button
                          onClick={() => onUndo()}
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-white flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          Apply
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
