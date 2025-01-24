import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";
import { ThumbsUp, ThumbsDown, Send, ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createPlanAction } from "@/lib/workspace/actions/create-plan";
import { Plan, Workspace } from "@/lib/types/workspace";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";

interface PlanChatMessageProps {
  showActions?: boolean;
  plan: Plan;
  onProceed?: () => void;
  onIgnore?: () => void;
  session?: Session;
  workspaceId?: string;
  messageId?: string;
  handlePlanUpdated: (plan: Plan) => void;
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  setWorkspace?: React.Dispatch<React.SetStateAction<Workspace>>;
}

export function PlanChatMessage({
  plan,
  showActions = true,
  onProceed,
  onIgnore,
  session,
  messageId,
  handlePlanUpdated,
  setMessages,
  setWorkspace
}: PlanChatMessageProps) {
  const { theme } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!plan.status?.includes('ignored'));

  // Automatically collapse when plan becomes superseded
  useEffect(() => {
    if (plan.status === 'ignored') {
      setIsExpanded(false);
    }
  }, [plan.status, plan.id]);
  const [chatInput, setChatInput] = useState("");
  const actionsRef = useRef<HTMLDivElement>(null);

  // Scroll when new actions are added
  useLayoutEffect(() => {
    if (plan.status === 'applying' && plan.actionFiles) {
      actionsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [plan.status, plan.actionFiles]);

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

  const handleProceed = async () => {
    if (!session || !plan) return;
    const updatedWorkspace = await createRevisionAction(session, plan.id);
    if (updatedWorkspace && setWorkspace) {
      setWorkspace(updatedWorkspace);
    }
    onProceed?.();
  };

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !plan) return;

    const tempId = `temp-${Date.now()}`;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `msg-${tempId}`,
      prompt: chatInput,
      response: undefined,
      role: 'user',
      createdAt: new Date(),
      workspaceId: plan.workspaceId,
      planId: tempId,
      userId: session.user.id,
      isOptimistic: true // Add flag to identify optimistic messages
    };

    // Create optimistic plan with planning status
    const optimisticPlan: Plan = {
      id: tempId,
      description: '', // Empty by default, will be filled by streaming updates
      status: 'planning',
      workspaceId: plan.workspaceId,
      chatMessageIds: [optimisticMessage.id],
      createdAt: new Date(),
    };

    // Optimistically update UI if handlers provided
    setMessages?.(prev => {
      return [...prev, optimisticMessage];
    });

    // Mark other plans as ignored when adding new plan
    setWorkspace?.(currentWorkspace => ({
      ...currentWorkspace,
      currentPlans: [
        optimisticPlan,
        ...currentWorkspace.currentPlans.map(existingPlan => ({
          ...existingPlan,
          status: 'ignored'
        }))
      ]
    }));

    // Clear input immediately for better UX
    setChatInput("");

    // Make actual API call
    await createPlanAction(session, chatInput, plan.workspaceId, plan.id);
  };

  return (
    <div className="space-y-2">
      <div className="px-4 py-2 mr-12">
        <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
          <div className={`text-xs ${
            plan.status === 'ignored'
              ? `${theme === "dark" ? "text-gray-500" : "text-gray-400"}`
              : `${theme === "dark" ? "text-primary/70" : "text-primary/70"}`
          } font-medium mb-1 flex items-center gap-2`}>
            <span>
              {plan.status === 'ignored' ? 'Superseded Plan' : 'Proposed Plan'}
            </span>
            <span className={`text-xs ${
              plan.status === 'planning'
                ? `${theme === "dark" ? "text-yellow-500/70" : "text-yellow-600/70"}`
                : plan.status === 'pending'
                  ? `${theme === "dark" ? "text-blue-500/70" : "text-blue-600/70"}`
                  : plan.status === 'review'
                    ? `${theme === "dark" ? "text-green-500/70" : "text-green-600/70"}`
                    : `${theme === "dark" ? "text-gray-500" : "text-gray-400"}`
            }`}>
              ({plan.status})
            </span>
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
            <style jsx>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
              </div>
            )}
            {plan.status === 'applying' && plan.actionFiles && (
              <div className="mt-4 border-t border-dark-border/20 pt-4">
                <div className="flex flex-col items-center gap-2" ref={actionsRef}>
                  {plan.actionFiles.map((action, index) => (
                    <div key={index} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-primary/5 min-w-0">
                      {action.status === 'created' ? (
                        <div className="text-green-500">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : action.status === 'creating' ? (
                        <div
                          className="rounded-full h-3 w-3 border border-primary/70 border-t-transparent"
                          style={{
                            animation: 'spin 1s linear infinite',
                            animationDelay: '0s'
                          }}
                        />
                      ) : (
                        <>
                          {action.action === 'create' && <Plus className="h-3 w-3 text-primary/70" />}
                          {action.action === 'update' && <Pencil className="h-3 w-3 text-primary/70" />}
                          {action.action === 'delete' && <Trash2 className="h-3 w-3 text-primary/70" />}
                        </>
                      )}
                      <span className={`${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                        {action.path}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          {showActions && plan.status === 'review' && (
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
                  onClick={handleProceed}
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
