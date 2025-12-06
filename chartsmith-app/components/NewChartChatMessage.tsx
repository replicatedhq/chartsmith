"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { useAtom } from "jotai";
import Image from "next/image";
import { Send } from "lucide-react";
import ReactMarkdown from 'react-markdown';

// Components
import { FeedbackModal } from "@/components/FeedbackModal";
import { ConversionProgress } from "@/components/ConversionProgress";
import { PlanChatMessage } from "@/components/PlanChatMessage";

// Types
import { Message } from "@/components/types";
import { Session } from "@/lib/types/session";

// Contexts
import { useTheme } from "../contexts/ThemeContext";

// atoms
import { conversionByIdAtom, messageByIdAtom, messagesAtom, renderByIdAtom, workspaceAtom } from "@/atoms/workspace";

// actions
import { cancelMessageAction } from "@/lib/workspace/actions/cancel-message";
import { performFollowupAction } from "@/lib/workspace/actions/perform-followup-action";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";

export interface ChatMessageProps {
  messageId: string;
  session: Session;
  showChatInput?: boolean;
  onContentUpdate?: () => void;
}

function LoadingSpinner({ message }: { message: string }) {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-2">
      <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
      <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{message}</div>
    </div>
  );
}

// Helper function to determine if a message is the first one for its revision number
function isFirstMessageForRevision(message: Message, messageId: string, allMessages: Message[]): boolean {
  if (!message.responseRollbackToRevisionNumber) {
    return false; // No revision number to check
  }

  const revisionNumber = message.responseRollbackToRevisionNumber;

  // Find all messages that have this revision number and sort by creation date
  const messagesWithRevision = allMessages
    .filter(m => m.responseRollbackToRevisionNumber === revisionNumber)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

  // Check if this message is the first one with this revision
  return messagesWithRevision.length > 0 &&
    messagesWithRevision[0].id === messageId;
}

export function NewChartChatMessage({
  messageId,
  session,
  showChatInput,
  onContentUpdate,
}: ChatMessageProps) {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [, setShowDropdown] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useAtom(messagesAtom);
  const [messageGetter] = useAtom(messageByIdAtom);
  const message = messageGetter(messageId);

  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [renderGetter] = useAtom(renderByIdAtom);
  // Only call the getter if responseRenderId exists
  const render = message?.responseRenderId ? renderGetter(message.responseRenderId) : undefined;
  const [conversionGetter] = useAtom(conversionByIdAtom);
  // Only call the getter if responseConversionId exists
  const conversion = message?.responseConversionId ? conversionGetter(message.responseConversionId) : undefined;

  // Check if this is the first message for its revision
  const isFirstForRevision = React.useMemo(() => {
    if (!message || !message.responseRollbackToRevisionNumber) return false;
    return isFirstMessageForRevision(message, messageId, messages);
  }, [message, messageId, messages]);

  // Move the useEffect outside of renderAssistantContent
  useEffect(() => {
    if (onContentUpdate && message) {
      onContentUpdate();
    }
  }, [message, message?.response, message?.responseRenderId, message?.responseConversionId, onContentUpdate]);

  const handleSubmitChat = async (e: FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      if (!session || !workspace) return;

      const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim(), "user");

      setMessages(prev => [...prev, chatMessage]);

      setChatInput("");
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [chatInput]);

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

  const handleApplyChanges = async () => {
    console.log("handleApplyChanges");
  }

  // Create a pure sorted content component
  // This ensures the order is always correct by hard-coding it
  const SortedContent = () => {
    return (
      <>
        {message?.response && (
          <div className="mb-4">
            <ReactMarkdown>{message.response}</ReactMarkdown>
          </div>
        )}

        {message?.responsePlanId && (
          <div className="w-full mb-4">
            {message.response && (
              <div className="border-t border-gray-200 dark:border-dark-border/30 pt-4 mb-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Plan:</div>
              </div>
            )}
            <PlanChatMessage
              planId={message.responsePlanId}
              showActions={false}
              showChatInput={false}
              session={session}
              messageId={messageId}
              workspaceId={workspace?.id}
              messages={messages} // Pass messages to resolve the reference error
            />
          </div>
        )}

        {message?.responseConversionId && (
          <div className="mt-4">
            {(message.response || message.responsePlanId || message.responseRenderId) && (
              <div className="border-t border-gray-200 dark:border-dark-border/30 pt-4 mb-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Conversion Progress:</div>
              </div>
            )}
            {conversion ? (
              <ConversionProgress conversionId={message.responseConversionId} />
            ) : (
              <LoadingSpinner message="Loading conversion status..." />
            )}
          </div>
        )}

        {message && !message.response && !message.responsePlanId && !message.responseRenderId && !message.responseConversionId && (
          <LoadingSpinner message="generating response..." />
        )}
      </>
    );
  };

  if (!message || !workspace) return null;

  return (
    <div className="space-y-2" data-testid="chat-message">
      {/* User Message */}
      <div className="px-2 py-1" data-testid="user-message">
        <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-primary/20" : "bg-primary/10"} rounded-tr-sm w-full`}>
          <div className="flex items-start gap-2">
            <Image
              src={session.user.imageUrl}
              alt={session.user.name}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full flex-shrink-0"
            />
            <div className="flex-1">
              <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-base pt-0.5 ${message.isCanceled ? "opacity-50" : ""}`}>{message.prompt}</div>
              {!message.isIntentComplete && !message.isCanceled && (
                <div className="flex items-center gap-2 mt-2 border-t border-primary/20 pt-2">
                  <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
                  <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>thinking...</div>
                  <button
                    className={`ml-auto text-xs px-1.5 py-0.5 rounded border ${theme === "dark" ? "border-dark-border text-gray-400 hover:text-gray-200" : "border-gray-300 text-gray-500 hover:text-gray-700"} hover:bg-dark-border/40`}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const chatMessage = await cancelMessageAction(session, message.id);
                      if (chatMessage && setMessages) {
                        setMessages((messages: Message[]) => messages.map((m: Message) => m.id === message.id ? (chatMessage as Message) : m));
                      }
                    }}
                  >
                    cancel
                  </button>
                </div>
              )}
              {message.isCanceled && (
                <div className="flex items-center gap-2 mt-2 border-t border-primary/20 pt-2">
                  <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Message generation canceled</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assistant Message */}
      {(message.response || message.responsePlanId || message.responseRenderId || message.responseConversionId || (message.isIntentComplete && !message.responsePlanId)) && (
        <div className="px-2 py-1" data-testid="assistant-message">
          <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm w-full`}>
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1 flex items-center justify-between`}>
              <div>ChartSmith</div>
              <div className="text-[10px] opacity-70">
                Rev #{
                  // Try to get actual revision number, otherwise use a hash of the message ID to generate a stable pseudo-revision
                  message.revisionNumber !== undefined
                    ? message.revisionNumber
                    : message.id
                      ? Array.from(message.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100
                      : "?"
                }
              </div>
            </div>
            <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} ${message.isIgnored ? "opacity-50 line-through" : ""} text-base markdown-content`}>
              {/* Use our custom component that enforces order */}
              <SortedContent />

              {/* Rollback link - only show if:
                 1. It has a rollback revision number
                 2. It's not the current revision
                 3. It's the first message for that revision */}
              {message.responseRollbackToRevisionNumber !== undefined &&
                workspace.currentRevisionNumber !== message.responseRollbackToRevisionNumber &&
                isFirstForRevision && (
                  <div className="mt-2 text-[9px] border-t border-gray-200 dark:border-dark-border/30 pt-1 flex justify-end">
                    <button
                      className={`${theme === "dark" ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"} hover:underline flex items-center`}
                      onClick={() => setShowRollbackModal(true)}
                    >
                      <svg className="w-2 h-2 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 8L12 13M12 13L15 10M12 13L9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      rollback to this revision
                    </button>
                  </div>
                )}
            </div>
            {message.followupActions && message.followupActions.length > 0 && (
              <div className="mt-4 flex gap-2 justify-end">
                {message.followupActions.map((action, index) => (
                  <button
                    key={index}
                    className={`text-xs px-2 py-1 rounded ${theme === "dark"
                        ? "bg-dark border-dark-border/60 text-gray-300 hover:text-white hover:bg-dark-border/40"
                        : "bg-white border border-gray-300 text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                      }`}
                    onClick={async () => {
                      const chatMessage = await performFollowupAction(session, workspace.id, message.id, action.action);
                      if (chatMessage && setMessages) {
                        setMessages((messages: Message[]) => [...messages, chatMessage]);
                      }
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            {showChatInput && (
              <div className="mt-6 border-t border-dark-border/20">
                <div className={`pt-4 ${message.responsePlanId ? "border-t border-dark-border/10" : ""}`}>
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
                          if (chatInput.trim() && handleSubmitChat) {
                            handleSubmitChat(e);
                          }
                        }
                      }}
                      placeholder="Ask a question or suggest changes..."
                      rows={1}
                      style={{ height: 'auto', minHeight: '34px', maxHeight: '150px' }}
                      className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${theme === "dark"
                          ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                          : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                        } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
                    />
                    <button
                      type="submit"
                      className={`absolute right-2 top-[5px] p-1.5 rounded-full ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                        } hover:bg-gray-100 dark:hover:bg-dark-border/40`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
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
        workspaceId={workspace.id}
        session={session}
      />
    </div>
  );
}
