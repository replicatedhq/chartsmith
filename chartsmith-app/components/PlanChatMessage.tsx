"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import ReactMarkdown from 'react-markdown';
import { useAtom } from "jotai";

// contexts
import { useTheme } from "@/contexts/ThemeContext";

// components
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";

// actions
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";
import { ThumbsUp, ThumbsDown, Send, ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from "lucide-react";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { messagesAtom, workspaceAtom, handlePlanUpdatedAtom, planByIdAtom } from "@/atoms/workspace";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";

// types
import { Message } from "@/components/types";
import { Session } from "@/lib/types/session";

interface PlanChatMessageProps {
  showActions?: boolean;
  showChatInput?: boolean;
  planId: string;
  onProceed?: () => void;
  onIgnore?: () => void;
  onContentUpdate?: () => void;
  session?: Session;
  workspaceId?: string;
  messageId?: string;
  messages?: Message[]; // Add messages prop
}

export function PlanChatMessage({
  planId,
  showActions = true,
  showChatInput = true,
  onProceed,
  onIgnore,
  onContentUpdate,
  session,
  messageId,
  messages,
  workspaceId,
}: PlanChatMessageProps) {
  const { theme } = useTheme();

  const [workspaceFromAtom, setWorkspace] = useAtom(workspaceAtom);
  const [messagesFromAtom, setMessages] = useAtom(messagesAtom);
  const [, handlePlanUpdated] = useAtom(handlePlanUpdatedAtom);

  // If workspaceId is provided, try to find the workspace in atom state
  const workspaceToUse = workspaceId
    ? workspaceFromAtom?.id === workspaceId ? workspaceFromAtom : undefined
    : workspaceFromAtom;
  // Use messages from props if provided, otherwise use from atom
  const messagesToUse = messages || messagesFromAtom;

  // Fix: Use useAtom directly with planByIdAtom
  const [planGetter] = useAtom(planByIdAtom);
  const plan = planGetter(planId);

  const [showFeedback, setShowFeedback] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [actionFilesExpanded, setActionFilesExpanded] = useState(true);

  const [chatInput, setChatInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const proceedButtonRef = useRef<HTMLButtonElement>(null);

  // Notify parent whenever important plan data changes
  useEffect(() => {
    if (!plan) return;

    // Notify parent that content has updated for global scrolling
    if (onContentUpdate) {
      // Use a timeout to ensure the DOM has updated
      setTimeout(() => {
        onContentUpdate();
      }, 100);
    }
  }, [
    plan?.status,
    plan?.actionFiles?.length,
    actionFilesExpanded,
    onContentUpdate
  ]);

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

  // We need to memoize this to avoid creating a new function on every render
  const callContentUpdate = useCallback(() => {
    if (onContentUpdate) onContentUpdate();
  }, [onContentUpdate]);

  // Trigger scroll to bottom when plan updates - specifically for streaming content
  useEffect(() => {
    if (!plan) return;

    // Only need to call once as this effect will re-run when the plan properties change
    // Let ScrollingContent handle the actual scrolling
    callContentUpdate();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plan?.description,
    plan?.status,
    plan?.actionFiles?.length,
    callContentUpdate,
    // Include plan in the deps array to fix the warning
    plan
  ]);

  // We've consolidated all scroll notifications into a single useEffect above
  // This effect is no longer needed and can be removed

  const handleIgnore = async () => {
    if (session && plan) {
      const wsId = workspaceId || plan.workspaceId;
      if (wsId) {
        await ignorePlanAction(session, wsId, "");
        onIgnore?.();
      }
    }
  };

  const handleProceed = async () => {
    if (!session || !plan) return;

    const wsId = workspaceId || plan.workspaceId;
    if (!wsId) return;

    const updatedWorkspace = await createRevisionAction(session, plan.id);
    if (updatedWorkspace && setWorkspace) {
      setWorkspace(updatedWorkspace);
    }
    onProceed?.();
  };

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !plan || !chatInput.trim()) return;

    setIsSubmitting(true);
    try {
      // Use workspaceId from props or fallback to workspace from atom
      const wsId = workspaceId || workspaceToUse?.id;
      if (!session || !wsId) return;

      const chatMessage = await createChatMessageAction(session, wsId, chatInput.trim());

      setMessages(prev => [...prev, chatMessage]);
      setChatInput("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!plan) return null;

  return (
    <div className="space-y-2" data-testid="plan-message">
      <div className="px-2 py-1">
        <div className={`p-3 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm w-full`}>
          <div className={`text-xs ${
            plan.status === 'ignored'
              ? `${theme === "dark" ? "text-gray-500" : "text-gray-400"}`
              : `${theme === "dark" ? "text-primary/70" : "text-primary/70"}`
          } font-medium mb-1 flex items-center gap-2`} data-testid="plan-message-top">
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
          } text-[11px] ${plan.status === 'ignored' ? 'opacity-75' : ''}`}>
            {plan.status === 'getting ready' ? (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full bg-primary/70"
                        style={{
                          animation: 'bounce 1.4s infinite ease-in-out',
                          animationDelay: `${i * 0.16}s`
                        }}
                      />
                    ))}
                  </div>
                  <div className="markdown-content">
                    <ReactMarkdown>{plan.description}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown>{plan.description}</ReactMarkdown>
              </div>
            )}
            {(plan.status === 'applying' || plan.status === 'applied') && (
              <div className="mt-4 light:border light:border-gray-200 pt-4 px-3 pb-2 rounded-lg bg-primary/5 dark:bg-dark-surface">
                <div className="flex items-center justify-between mb-2" ref={actionsRef}>
                  <span className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    {(!plan.actionFiles || plan.actionFiles.length === 0) && plan.status === 'applying'
                      ? "selecting files..."
                      : `${plan.actionFiles?.length || 0} file ${(plan.actionFiles?.length || 0) === 1 ? 'change' : 'changes'}`
                    }
                  </span>
                  {(plan.actionFiles?.length || 0) > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionFilesExpanded(!actionFilesExpanded)}
                      className={`p-1 ${theme === "dark" ? "hover:bg-dark-border/40 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                    >
                      {actionFilesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {(plan.actionFiles?.length || 0) > 0 && (
                  <div
                    className={`flex flex-col items-center gap-2 overflow-hidden transition-all duration-300 ${
                      actionFilesExpanded ? 'max-h-none' : 'max-h-0'
                    }`}
                  >
                    {plan.actionFiles?.map((action, index) => (
                      <div key={index} className="w-full flex items-center">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-primary/5 w-fit">
                          <div className="flex-shrink-0">
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
                          </div>
                          <span className={`${theme === "dark" ? "text-gray-300" : "text-gray-600"} truncate font-mono text-[10px]`}>
                            {action.path}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    ref={proceedButtonRef}
                    variant="default"
                    size="sm"
                    onClick={handleProceed}
                    data-testid="plan-message-proceed-button"
                    className="min-w-[100px] bg-primary hover:bg-primary/80 text-white"
                  >
                    Proceed
                  </Button>
                </div>
                {showChatInput && plan.status === 'review' && !workspaceToUse?.currentRevisionNumber && (
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
                        placeholder={isSubmitting ? "Submitting..." : "Ask a question or suggest changes..."}
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                        className={`absolute right-2 top-[5px] p-1.5 rounded-full ${
                          !isSubmitting ? 'hover:bg-gray-100 dark:hover:bg-dark-border/40' : ''
                        } ${
                          theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {isSubmitting ? (
                          <div
                            className="rounded-full h-4 w-4 border border-current border-t-transparent"
                            style={{
                              animation: 'spin 1s linear infinite'
                            }}
                          />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          }
        </div>
      </div>
      {showFeedback && session && (
        <FeedbackModal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          message={{ id: messageId } as Message}
          chatId={plan.id}
          workspaceId={workspaceId || plan.workspaceId}
          session={session}
        />
      )}
    </div>
  );
}
