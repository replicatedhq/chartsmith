import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface PlanChatMessageProps {
  showActions?: boolean;
  description: string;
  onProceed?: () => void;
  onIgnore?: () => void;
  session?: Session;
  workspaceId?: string;
  messageId?: string;
}

export function PlanChatMessage({
  description,
  showActions = true,
  onProceed,
  onIgnore,
  session,
  workspaceId,
  messageId
}: PlanChatMessageProps) {
  const { theme } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const handleIgnore = async () => {
    if (session && workspaceId && messageId) {
      await ignorePlanAction(session, workspaceId, messageId);
      onIgnore?.();
    }
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle chat submission here
    setChatInput("");
  };

  return (
    <div className="space-y-2">
      <div className="px-4 py-2 mr-12">
        <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
          <div className={`text-xs ${theme === "dark" ? "text-primary/70" : "text-primary/70"} font-medium mb-1`}>Proposed Plan</div>
          <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm whitespace-pre-wrap`}>
            {description}
          </div>
          {showActions && (
            <div className="mt-6 border-t border-dark-border/20">
              <div className="flex items-center justify-between pt-4 pb-3">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeedback(true)}
                    className={`p-2 ${theme === "dark" ? "hover:bg-dark-border/40 text-gray-400 hover:text-gray-200" : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"}`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleIgnore}
                    className={`p-2 ${theme === "dark" ? "hover:bg-dark-border/40 text-gray-400 hover:text-gray-200" : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"}`}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
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
              <div className="pt-2 border-t border-dark-border/10">
                <form onSubmit={handleSubmitChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question or suggest changes..."
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md border ${
                      theme === "dark" 
                        ? "bg-dark border-dark-border/60 text-white placeholder-gray-500" 
                        : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                    } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
                  />
                  <Button 
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className={`px-3 ${theme === "dark" ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
                  >
                    Send
                  </Button>
                </form>
              </div>
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
