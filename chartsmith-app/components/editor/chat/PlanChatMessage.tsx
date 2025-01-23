import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";
import { ThumbsUp, ThumbsDown, Send, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createPlanAction } from "@/lib/workspace/actions/create-plan";
import { Plan } from "@/lib/types/workspace";

interface PlanChatMessageProps {
  showActions?: boolean;
  plan: Plan;
  onProceed?: () => void;
  onIgnore?: () => void;
  session?: Session;
  workspaceId?: string;
  messageId?: string;
}

export function PlanChatMessage({
  plan,
  showActions = true,
  onProceed,
  onIgnore,
  session,
  messageId
}: PlanChatMessageProps) {
  const { theme } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!plan.status?.includes('ignored'));
  const [chatInput, setChatInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [chatInput]);

  const handleIgnore = async () => {
    if (session && plan) {
      await ignorePlanAction(session, plan.workspaceId, "");
      onIgnore?.();
    }
  };

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !plan) return;
    const p = await createPlanAction(session, chatInput, plan.workspaceId, plan.id);
    console.log(p);
    setChatInput("");
  };

  return (
    <div className="space-y-2">
      <div className="px-4 py-2 mr-12">
        <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
          <div className={`text-xs ${
            plan.status === 'ignored' 
              ? `${theme === "dark" ? "text-gray-500" : "text-gray-400"}`
              : `${theme === "dark" ? "text-primary/70" : "text-primary/70"}`
          } font-medium mb-1`}>
            {plan.status === 'ignored' ? 'Superseded Plan' : 'Proposed Plan'}
          </div>
          <div className={`${
            plan.status === 'ignored'
              ? `${theme === "dark" ? "text-gray-400" : "text-gray-500"}`
              : `${theme === "dark" ? "text-gray-200" : "text-gray-700"}`
          } text-sm markdown-content ${plan.status === 'ignored' ? 'opacity-75' : ''}`}>
            {plan.status === 'ignored' && !isExpanded ? (
              <div className="flex items-center justify-between">
                <div className="line-clamp-2">
                  <ReactMarkdown>{plan.description}</ReactMarkdown>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                  className={`ml-2 p-1 ${theme === "dark" ? "hover:bg-dark-border/40 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <ReactMarkdown>{plan.description}</ReactMarkdown>
                {plan.status === 'ignored' && (
                  <div className="absolute top-0 right-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(false)}
                      className={`p-1 ${theme === "dark" ? "hover:bg-dark-border/40 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
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
                <form onSubmit={handleSubmitChat} className="relative">
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitChat(e);
                      }
                    }}
                    placeholder="Ask a question or suggest changes..."
                    rows={1}
                    style={{ height: 'auto', minHeight: '34px', maxHeight: '150px' }}
                    className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                      theme === "dark"
                        ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                        : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                    } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
                  />
                  <button
                    type="submit"
                    className={`absolute right-2 top-[5px] p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border/40 ${
                      theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      {showFeedback && session && plan.workspaceId && (
        <FeedbackModal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          message={{ id: messageId } as Message}
          chatId={plan.id}
          workspaceId={plan.workspaceId}
          session={session}
        />
      )}
    </div>
  );
}
