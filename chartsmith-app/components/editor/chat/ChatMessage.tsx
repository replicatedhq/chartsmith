import React, { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { Workspace } from "@/lib/types/workspace";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { Send, ThumbsUp, ThumbsDown } from "lucide-react";

export interface ChatMessageProps {
  message: Message;
  onApplyChanges?: () => void;
  session: Session;
  workspaceId: string;
  showActions?: boolean;
  setMessages?: (messages: Message[]) => void;
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
              <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-[12px] pt-0.5`}>{message.prompt}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Assistant Message - only show if there's a response */}
      {message.response && (
        <div className="px-2 py-1">
          <div className={`p-3 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm w-full`}>
            <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>ChartSmith</div>
            <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} ${message.isIgnored ? "opacity-50 line-through" : ""} text-[12px] whitespace-pre-wrap`}>
              {(() => {
                return message.response || (!message.isComplete ? "..." : "");
              })()}
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
            {showChatInput && (
              <div className="mt-6 border-t border-dark-border/20">
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
                <div className="pt-4 border-t border-dark-border/10">
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
