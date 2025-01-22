import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";
import { ChevronDown } from "lucide-react";

interface PlanChatMessageProps {
  showActions?: boolean;
  description: string;
  onProceed?: () => void;
  onEdit?: () => void;
  onIgnore?: () => void;
  session?: Session;
  workspaceId?: string;
  messageId?: string;
}

export function PlanChatMessage({
  description,
  showActions = true,
  onProceed,
  onEdit,
  onIgnore,
  session,
  workspaceId,
  messageId
}: PlanChatMessageProps) {
  const { theme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleIgnore = async () => {
    if (session && workspaceId && messageId) {
      await ignorePlanAction(session, workspaceId, messageId);
      onIgnore?.();
    }
    setShowDropdown(false);
  };

  return (
    <div className="space-y-2">
      <div className="px-4 py-2 mr-12">
        <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
          <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>ChartSmith</div>
          <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm whitespace-pre-wrap`}>
            {description}
          </div>
          {showActions && (
            <div className="flex gap-4 mt-6 justify-center border-t pt-4 border-dark-border/20">
              <div className="relative" ref={dropdownRef}>
                <div className="flex">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onEdit}
                    className={`min-w-[100px] rounded-r-none ${theme === "dark" ? "hover:bg-dark-border/40" : "hover:bg-gray-100"}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className={`px-2 rounded-l-none border-l-0 ${theme === "dark" ? "hover:bg-dark-border/40" : "hover:bg-gray-100"}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                {showDropdown && (
                  <div className={`absolute left-0 mt-1 w-48 rounded-md shadow-lg ${theme === "dark" ? "bg-dark-surface border border-dark-border" : "bg-white border border-gray-200"}`}>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          onEdit?.();
                          setShowDropdown(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm ${theme === "dark" ? "text-gray-200 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleIgnore}
                        className={`block w-full text-left px-4 py-2 text-sm ${theme === "dark" ? "text-gray-200 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"}`}
                      >
                        Ignore
                      </button>
                      <button
                        onClick={() => {
                          setShowFeedback(true);
                          setShowDropdown(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm ${theme === "dark" ? "text-gray-200 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"}`}
                      >
                        Provide Feedback
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={onProceed}
                className="min-w-[100px] bg-primary hover:bg-primary/80 text-white"
              >
                Proceed
              </Button>
            </div>
          )}
        </div>
      </div>
      {showFeedback && session && workspaceId && messageId && (
        <FeedbackModal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          message={{ id: messageId } as Message}
          chatId={messageId}
          workspaceId={workspaceId}
          session={session}
        />
      )}
    </div>
  );
}
