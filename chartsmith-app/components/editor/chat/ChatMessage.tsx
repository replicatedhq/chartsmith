import React, { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { Workspace } from "@/lib/types/workspace";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { Send, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { cancelMessageAction } from "@/lib/workspace/actions/cancel-message";
import { FeedbackModal } from "@/components/FeedbackModal";
import { performFollowupAction } from "@/lib/workspace/actions/perform-followup-action";
import { getWorkspaceRenderAction } from "@/lib/workspace/actions/get-workspace-render";
import { RenderedWorkspace } from "@/lib/types/workspace";

export interface ChatMessageProps {
  message: Message;
  onApplyChanges?: () => void;
  session: Session;
  workspaceId: string;
  showActions?: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setWorkspace?: React.Dispatch<React.SetStateAction<Workspace>>;
  showChatInput?: boolean;
  onSendMessage?: (message: string) => void;
  workspace?: Workspace;
}

export function ChatMessage({
  message,
  onApplyChanges,
  session,
  workspaceId,
  showActions = true,
  setMessages,
  setWorkspace,
  showChatInput,
  onSendMessage,
  workspace
}: ChatMessageProps) {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [renderedWorkspace, setRenderedWorkspace] = useState<RenderedWorkspace | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (message.responseRenderId && !renderedWorkspace) {
      console.log("Attempting to fetch render workspace:", {
        renderId: message.responseRenderId,
        message
      });

      getWorkspaceRenderAction(session, message.responseRenderId)
        .then(render => {
          setRenderedWorkspace(render);
        })
        .catch(err => {
          console.error("Failed to get rendered workspace", { err });
        });
    }
  }, [message.responseRenderId, session, renderedWorkspace]);

  const handleSubmitChat = (e: FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && onSendMessage) {
      onSendMessage(chatInput);
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

  let depUpdateCommand = renderedWorkspace?.charts?.[0]?.depUpdateCommand;
  let depUpdateStderr = renderedWorkspace?.charts?.[0]?.depUpdateStderr;
  let depUpdateStdout = renderedWorkspace?.charts?.[0]?.depUpdateStdout;
  let helmTemplateCommand = renderedWorkspace?.charts?.[0]?.helmTemplateCommand;
  let helmTemplateStdout = renderedWorkspace?.charts?.[0]?.helmTemplateStdout;
  let helmTemplateStderr = renderedWorkspace?.charts?.[0]?.helmTemplateStderr;

  if (message.renderStreamData) {
    if (message.renderStreamData.depUpdateCommand) {
      depUpdateCommand = message.renderStreamData.depUpdateCommand;
    }
    if (message.renderStreamData.depUpdateStderr) {
      depUpdateStderr = message.renderStreamData.depUpdateStderr;
    }
    if (message.renderStreamData.depUpdateStdout) {
      depUpdateStdout = message.renderStreamData.depUpdateStdout;
    }
    if (message.renderStreamData.helmTemplateCommand) {
      helmTemplateCommand = message.renderStreamData.helmTemplateCommand;
    }
    if (message.renderStreamData.helmTemplateStdout) {
      helmTemplateStdout = message.renderStreamData.helmTemplateStdout;
    }
    if (message.renderStreamData.helmTemplateStderr) {
      helmTemplateStderr = message.renderStreamData.helmTemplateStderr;
    }
  }

  return (
    <div className="space-y-2">
      {/* User Message */}
      <div className="px-2 py-1">
        <div className={`p-3 rounded-2xl ${theme === "dark" ? "bg-primary/20" : "bg-primary/10"} rounded-tr-sm w-full`}>
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
      {(message.response || (message.isIntentComplete && !message.intent?.isPlan)) && (
        <div className="px-2 py-1">
          <div className={`p-3 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm w-full`}>
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>ChartSmith</div>
            <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} ${message.isIgnored ? "opacity-50 line-through" : ""} text-[12px] markdown-content`}>
              {message.responseRenderId || message.renderStreamData ? (
                <div className={`mt-2 rounded-md overflow-hidden font-mono ${theme === "dark" ? "bg-[#1e1e1e]" : "bg-[#282a36]"}`}>
                  <div className={`flex items-center px-3 py-1.5 ${theme === "dark" ? "bg-[#323232]" : "bg-[#44475a]"}`}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                    </div>
                    <div className={`flex-1 text-center text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-300"}`}>
                      terminal
                    </div>
                  </div>
                  <div className={`p-3 text-xs ${theme === "dark" ? "text-gray-300" : "text-gray-100"}`}>
                    {!depUpdateCommand && !helmTemplateCommand ? (
                      <div className="mt-1 flex items-center">
                        <span className="w-2 h-4 bg-gray-300 animate-pulse"></span>
                      </div>
                    ) : (
                      <>
                        {depUpdateCommand && (
                          <div className="flex gap-2">
                            <span className="flex-shrink-0 text-primary/70">% </span>
                            <span className="text-primary/70">{depUpdateCommand}</span>
                          </div>
                        )}
                        {depUpdateStderr ? (
                          <div className="mt-2 text-red-400 whitespace-pre-wrap">
                            {depUpdateStderr}
                          </div>
                        ) : depUpdateStdout ? (
                          <div className="mt-2 whitespace-pre-wrap">
                            {depUpdateStdout}
                            <div className="mt-1 flex items-center">
                              <span className="w-2 h-4 bg-gray-300 animate-pulse"></span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center">
                            <span className="w-2 h-4 bg-gray-300 animate-pulse"></span>
                          </div>
                        )}
                        {helmTemplateCommand && (
                          <div className="flex gap-2 mt-4">
                            <span className="flex-shrink-0 text-primary/70">% </span>
                            <span className="text-primary/70 whitespace-pre-wrap">{helmTemplateCommand}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : message.response ? (
                <ReactMarkdown>{message.response}</ReactMarkdown>
              ) : (!message.intent?.isPlan && (
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
                  <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>generating response...</div>
                </div>
              ))}
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
                      const chatMessage = await performFollowupAction(session, workspaceId, message.id, action.action);
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
            {showChatInput && (
              <div className="mt-6 border-t border-dark-border/20">
                {message.intent?.isPlan && (
                  <div className="flex items-center justify-between pt-4 pb-3">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowReportModal(true)}
                        className={`p-2 ${theme === "dark" ? "hover:bg-dark-border/40 text-gray-400 hover:text-gray-200" : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"}`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (session && workspace?.currentPlans[0]) {
                            await ignorePlanAction(session, workspaceId, "");
                          }
                        }}
                        className={`p-2 ${theme === "dark" ? "hover:bg-dark-border/40 text-gray-400 hover:text-gray-200" : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"}`}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={async () => {
                        if (session && workspace?.currentPlans[0]) {
                          const updatedWorkspace = await createRevisionAction(session, workspace.currentPlans[0].id);
                          if (updatedWorkspace && setWorkspace) {
                            setWorkspace(updatedWorkspace);
                          }
                        }
                      }}
                      className="min-w-[100px] bg-primary hover:bg-primary/80 text-white"
                    >
                      Proceed
                    </Button>
                  </div>
                )}
                <div className={`pt-4 ${message.intent?.isPlan ? "border-t border-dark-border/10" : ""}`}>
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
                          if (chatInput.trim() && onSendMessage) {
                            onSendMessage(chatInput);
                            setChatInput('');
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
        workspaceId={workspaceId}
        session={session}
      />
    </div>
  );
}
