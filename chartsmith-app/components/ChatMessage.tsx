"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { useAtom } from "jotai";
import Image from "next/image";
import { Send } from "lucide-react";
import ReactMarkdown from 'react-markdown';

// Components
import { Terminal } from "@/components/Terminal";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ConversionProgress } from "@/components/ConversionProgress";

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
import { rollbackWorkspaceAction } from "@/lib/workspace/actions/rollback";

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

export function ChatMessage({
  messageId,
  session,
  showChatInput,
  onContentUpdate,
}: ChatMessageProps) {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [, setShowDropdown] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [, setMessages] = useAtom(messagesAtom);
  const [messageGetter] = useAtom(messageByIdAtom);
  const message = messageGetter(messageId);

  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [renderGetter] = useAtom(renderByIdAtom);
  const render = renderGetter(message!.responseRenderId!);
  const [conversionGetter] = useAtom(conversionByIdAtom);
  const conversion = conversionGetter(message!.responseConversionId!);

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

      const chatMessage = await createChatMessageAction(session, workspace.id, chatInput.trim());

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

  const renderAssistantContent = () => {
    if (!message) return null;

    // Show rendered charts
    if (message.responseRenderId) {
      return (
        <div className="space-y-4">
          {render?.charts.map((chart, index) => (
            <Terminal
              key={`${messageId}-${render.id}-${chart.id}-${index}`}
              data-testid="chart-terminal"
              chart={chart}
              depUpdateCommandStreamed={chart.depUpdateCommand}
              depUpdateStderrStreamed={chart.depUpdateStderr}
              depUpdateStdoutStreamed={chart.depUpdateStdout}
              helmTemplateCommandStreamed={chart.helmTemplateCommand}
              helmTemplateStderrStreamed={chart.helmTemplateStderr}
            />
          ))}
        </div>
      );
    }

    // Show conversion status
    if (message.responseConversionId) {
      return <ConversionProgress conversionId={message.responseConversionId} />;
    }

    // Show markdown response
    if (message.response) {
      return <ReactMarkdown>{message.response}</ReactMarkdown>;
    }

    // Show generating response status
    if (!message.responsePlanId) {
      return <LoadingSpinner message="generating response..." />;
    }

    return null;
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
              <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-[12px] pt-0.5 ${message.isCanceled ? "opacity-50" : ""}`}>{message.prompt}</div>
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
      {(message.response || (message.isIntentComplete && !message.responsePlanId)) && (
        <div className="px-2 py-1" data-testid="assistant-message">
          <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm w-full`}>
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>ChartSmith</div>
            <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} ${message.isIgnored ? "opacity-50 line-through" : ""} text-[12px] markdown-content`}>
              {renderAssistantContent()}

              {/* Rollback link for imported charts - only show if it's not the current revision */}
              {message.responseRollbackToRevisionNumber !== undefined &&
               workspace.currentRevisionNumber !== message.responseRollbackToRevisionNumber && (
                <div className="mt-2 text-[9px] border-t border-gray-200 dark:border-dark-border/30 pt-1 flex justify-end">
                  <button
                    className={`${theme === "dark" ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"} hover:underline flex items-center`}
                    onClick={async () => {
                      try {
                        const updatedWorkspace = await rollbackWorkspaceAction(session, workspace.id, message.responseRollbackToRevisionNumber!);
                        setWorkspace(updatedWorkspace);
                        console.log(`Successfully rolled back to revision ${message.responseRollbackToRevisionNumber}`);
                      } catch (error) {
                        console.error(`Error rolling back to revision:`, error);
                      }
                    }}
                  >
                    <svg className="w-2 h-2 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8L12 13M12 13L15 10M12 13L9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
                    className={`text-xs px-2 py-1 rounded ${
                      theme === "dark"
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
                      className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                        theme === "dark"
                          ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                          : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                      } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
                    />
                    <button
                      type="submit"
                      className={`absolute right-2 top-[5px] p-1.5 rounded-full ${
                        theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
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
