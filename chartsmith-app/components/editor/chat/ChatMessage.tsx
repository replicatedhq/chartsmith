import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";

interface ChatMessageProps {
  message: Message;
  onApplyChanges?: () => void;
  session: Session;
  workspaceId: string;
  showActions?: boolean;
  setMessages: (messages: Message[]) => void;
}

export function ChatMessage({ message, onApplyChanges, session, workspaceId, showActions = true, setMessages }: ChatMessageProps) {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  return (
    <div className="space-y-2">
      {/* User Message */}
      <div className="px-4 py-2 ml-12">
        <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-primary/20" : "bg-primary/10"} rounded-tr-sm`}>
          <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>You</div>
          <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm`}>{message.prompt}</div>
        </div>
      </div>

      {/* Assistant Message - show if there's a response or if message is incomplete */}
      {(message.response !== undefined || !message.isComplete) && (
        <div className="px-4 py-2 mr-12">
          <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>ChartSmith</div>
            <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} ${message.isIgnored ? "opacity-50 line-through" : ""} text-sm whitespace-pre-wrap`}>
              {message.response || (!message.isComplete ? "..." : "")}
            </div>
            {message.isComplete && !message.isApplied && showActions && onApplyChanges && (
              <div className="mt-4 space-y-4 border-t border-gray-700/10 pt-4">
                {message.isApplying ? (
                  <div className="flex justify-center mt-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="flex justify-end items-center gap-3 mt-4">
                    <div className="relative" ref={dropdownRef}>
                      <div className="flex">
                        <Button
                          onClick={() => setShowReportModal(true)}
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-r-none border-r"
                        >
                          Feedback
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDropdown(!showDropdown);
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 rounded-l-none"
                        >
                          ↓
                        </Button>
                      </div>
                      {showDropdown && (
                        <div className={`absolute right-0 mt-1 w-32 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"} border rounded-md shadow-lg z-50`}>
                          <button
                            onClick={async () => {
                              setShowDropdown(false);
                              // Make server call in background
                              await ignorePlanAction(session, workspaceId, message.id);
                            }}
                            className={`w-full px-4 py-2 text-sm text-left ${theme === "dark" ? "text-gray-200 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"}`}
                          >
                            Ignore
                          </button>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => onApplyChanges()}
                      size="sm"
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

    </div>
  );
}
