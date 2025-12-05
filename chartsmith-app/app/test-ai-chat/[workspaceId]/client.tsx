"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSetAtom, useAtom } from "jotai";
import { Loader2, Send, Home, Code } from "lucide-react";
import Link from "next/link";
import { Tooltip } from "@/components/ui/Tooltip";
import { UserMenu } from "@/components/UserMenu";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Editor from "@monaco-editor/react";

// Atoms - NOTE: chartsAtom and looseFilesAtom are DERIVED atoms (read-only)
// They automatically derive from workspaceAtom - only set workspaceAtom
import { workspaceAtom, selectedFileAtom, editorViewAtom, renderedFilesAtom, allFilesWithContentPendingAtom } from "@/atoms/workspace";

// Hooks
import { useCentrifugo } from "@/hooks/useCentrifugo";

// Actions
import { createAISDKChatMessageAction } from "@/lib/workspace/actions/create-ai-sdk-chat-message";
import { updateChatMessageResponseAction } from "@/lib/workspace/actions/update-chat-message-response";
import { commitPendingChangesAction } from "@/lib/workspace/actions/commit-pending-changes";
import { discardPendingChangesAction } from "@/lib/workspace/actions/discard-pending-changes";

// Components
import { ScrollingContent } from "@/components/ScrollingContent";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { FileBrowser } from "@/components/FileBrowser";
import { useTheme } from "@/contexts/ThemeContext";
import ReactMarkdown from "react-markdown";
import Image from "next/image";

// Types
import { Workspace, ChatMessage } from "@/lib/types/workspace";
import { Session } from "@/lib/types/session";
import { Message } from "@/components/types";

// Config
import {
  getDefaultProvider,
  getDefaultModelForProvider,
  STREAMING_THROTTLE_MS,
} from "@/lib/ai";

interface TestAIChatClientProps {
  workspace: Workspace;
  session: Session;
  initialMessages?: Message[];
}

export function TestAIChatClient({ workspace, session, initialMessages = [] }: TestAIChatClientProps) {
  const { theme } = useTheme();

  // Atom setter for hydration - only set workspaceAtom
  // chartsAtom and looseFilesAtom are derived and update automatically
  const setWorkspace = useSetAtom(workspaceAtom);

  // Atoms for code editor panel
  const [selectedFile] = useAtom(selectedFileAtom);
  const [view, setView] = useAtom(editorViewAtom);
  const [renderedFiles] = useAtom(renderedFilesAtom);

  // Atom for pending changes
  const [filesWithPending] = useAtom(allFilesWithContentPendingAtom);
  const hasPendingChanges = filesWithPending.length > 0;

  // Add Centrifugo for real-time file updates
  // This replaces the previous refetch-after-tool-completion workaround
  useCentrifugo({ session });

  // Hydrate workspace atom on mount
  // Charts and files derive automatically from workspaceAtom
  useEffect(() => {
    setWorkspace(workspace);
  }, [workspace, setWorkspace]);

  const revisionNumber = workspace.currentRevisionNumber ?? 0;

  const [chatInput, setChatInput] = useState("");
  const [currentChatMessageId, setCurrentChatMessageId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSentRef = useRef(false); // Use ref to prevent re-renders triggering duplicate sends
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const selectedProvider = getDefaultProvider();
  const selectedModel = getDefaultModelForProvider(selectedProvider);

  // Helper to get fresh body params for each request
  // NOTE: body is NOT passed to useChat - it would be captured at initialization and become stale
  // Instead, we pass body in each sendMessage() call to ensure fresh values
  // See: https://ai-sdk.dev/docs/troubleshooting/use-chat-stale-body-data
  const getChatBody = useCallback(() => ({
    provider: selectedProvider,
    model: selectedModel,
    workspaceId: workspace.id,
    revisionNumber,
  }), [selectedProvider, selectedModel, workspace.id, revisionNumber]);

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    experimental_throttle: STREAMING_THROTTLE_MS,
    onError: (err) => {
      console.error('[useChat] Error:', err);
    },
    onFinish: () => {
      console.log('[useChat] Finished');
    },
  });

  // Debug: Log status and message changes
  useEffect(() => {
    console.log('[useChat] Status changed:', status);
  }, [status]);

  useEffect(() => {
    console.log('[useChat] Messages updated:', messages.length, messages);
  }, [messages]);

  useEffect(() => {
    if (error) {
      console.error('[useChat] Error state:', error);
    }
  }, [error]);

  const isLoading = status === "submitted" || status === "streaming";

  // Focus chat input on mount
  useEffect(() => {
    chatInputRef.current?.focus();
  }, []);

  // Auto-send: If there's an initial message without a response, send it to the AI
  // This handles the flow from landing page where createWorkspaceFromPromptAction
  // persists the user message to DB, then we need to get the AI response
  useEffect(() => {
    // Use ref check FIRST to prevent any possibility of double-send
    if (hasAutoSentRef.current) return;

    // Find the last user message in initialMessages that has no response
    const lastUserMessage = initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1]
      : null;

    // Only auto-send if there's a user message without a response
    const needsResponse = lastUserMessage && !lastUserMessage.response && lastUserMessage.prompt;

    if (needsResponse && messages.length === 0 && workspace?.id) {
      // Mark as sent BEFORE calling sendMessage to prevent race conditions
      hasAutoSentRef.current = true;
      console.log('[useChat] Auto-sending initial message to AI:', lastUserMessage.prompt);
      sendMessage(
        { text: lastUserMessage.prompt },
        { body: getChatBody() }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - ref guards against duplicates

  // Note: PR1.7 replaced the refetch-after-tool-completion workaround with Centrifugo real-time updates
  // File explorer now updates automatically via useCentrifugo hook receiving artifact-updated events

  // Persist AI response when complete
  useEffect(() => {
    if (status === "ready" && currentChatMessageId && messages.length > 0) {
      const lastAssistant = messages.filter(m => m.role === "assistant").pop();
      if (lastAssistant) {
        // Extract text content from parts
        const textContent = lastAssistant.parts
          ?.filter((p: { type: string }) => p.type === "text")
          .map((p: { type: string; text?: string }) => p.text)
          .join("\n") || "";

        updateChatMessageResponseAction(
          session,
          currentChatMessageId,
          textContent,
          true
        ).then(() => {
          setCurrentChatMessageId(null);
        });
      }
    }
  }, [status, currentChatMessageId, messages, session]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !isLoading) {
      const messageText = chatInput.trim();
      setChatInput("");

      try {
        // 1. Persist user message using AI SDK-specific action (skips Go intent processing)
        const chatMessage = await createAISDKChatMessageAction(
          session,
          workspace.id,
          messageText
        );
        setCurrentChatMessageId(chatMessage.id);

        // 2. Send to AI SDK with fresh body params
        await sendMessage(
          { text: messageText },
          { body: getChatBody() }  // Fresh values at request time
        );
      } catch (error) {
        console.error("Failed to persist message:", error);
        // Still send to AI SDK even if persistence fails
        await sendMessage(
          { text: messageText },
          { body: getChatBody() }
        );
      }
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(e);
    }
  };

  const handleCommit = async () => {
    if (isCommitting || !hasPendingChanges) return;
    setIsCommitting(true);
    try {
      const updated = await commitPendingChangesAction(session, workspace.id);
      setWorkspace(updated);
    } catch (err) {
      console.error("Failed to commit changes:", err);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDiscard = async () => {
    if (isDiscarding || !hasPendingChanges) return;
    if (!confirm("Discard all pending changes? This cannot be undone.")) return;
    setIsDiscarding(true);
    try {
      const updated = await discardPendingChangesAction(session, workspace.id);
      setWorkspace(updated);
    } catch (err) {
      console.error("Failed to discard changes:", err);
    } finally {
      setIsDiscarding(false);
    }
  };

  const userImageUrl = session.user.imageUrl || "";
  const userName = session.user.name || "User";

  // Helper to get file language for Monaco editor
  const getLanguageFromPath = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'md': 'markdown',
      'tpl': 'yaml', // Helm templates
    };
    return langMap[ext] || 'plaintext';
  };

  // Get rendered file for current selection
  const getRenderedFile = () => {
    if (!selectedFile) return null;

    // Try exact match first
    let renderedFile = renderedFiles.find(rf => rf.filePath === selectedFile.filePath);

    // If no exact match, look for a rendered file with a matching name
    if (!renderedFile) {
      const selectedFileName = selectedFile.filePath.split('/').pop() || '';
      renderedFile = renderedFiles.find(rf => {
        const renderedFileName = rf.filePath.split('/').pop() || '';
        return renderedFileName === selectedFileName;
      });
    }

    // Special handling for templates
    if (!renderedFile && selectedFile.filePath.includes('/templates/')) {
      const baseFileName = selectedFile.filePath.split('/').pop()?.replace('.yaml.tpl', '.yaml').replace('.tpl', '') || '';
      renderedFile = renderedFiles.find(rf => {
        const renderedFileName = rf.filePath.split('/').pop() || '';
        return renderedFileName === baseFileName;
      });
    }

    return renderedFile;
  };

  return (
    <EditorLayout>
      <div className="flex w-full h-[calc(100vh-3.5rem)]">
        {/* Left Sidebar - Icons for navigation */}
        <nav className={`w-16 flex-shrink-0 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"} border-r flex flex-col justify-between`}>
          <div className="py-4 flex flex-col items-center">
            <Tooltip content="Home">
              <Link href="/test-ai-chat" className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}>
                <Home className="w-5 h-5" />
              </Link>
            </Tooltip>

            <div className="mt-8 w-full px-3">
              <div className={`border-t ${theme === "dark" ? "border-dark-border" : "border-light-border"}`} />
            </div>

            <div className="mt-4">
              <Tooltip content="Workspace">
                <Link
                  href={`/test-ai-chat/${workspace.id}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${theme === "dark" ? "bg-dark-border/60" : "bg-light-border/60"} text-primary`}
                >
                  <Code className="w-5 h-5" />
                </Link>
              </Tooltip>
            </div>

          </div>

          <div className="py-4 flex justify-center">
            <UserMenu />
          </div>
        </nav>

        {/* Chat Panel - LEFT (480px fixed) */}
        <div className="w-[480px] flex-shrink-0 flex flex-col min-w-0 overflow-hidden relative">
          <div className="flex-1 h-full">
            <ScrollingContent forceScroll={true}>
              <div className="pb-64">
                {/* Previous conversation history from database */}
                {/* Only show messages that have responses - pending messages are handled by AI SDK */}
                {initialMessages.filter(msg => msg.response).length > 0 && (
                  <div className={`mx-2 mb-4 pb-4 border-b ${
                    theme === "dark" ? "border-dark-border" : "border-gray-200"
                  }`}>
                    <div className={`text-xs mb-2 px-2 ${
                      theme === "dark" ? "text-gray-500" : "text-gray-400"
                    }`}>
                      Previous conversation
                    </div>
                    {initialMessages.filter(msg => msg.response).map((msg) => (
                      <div key={msg.id} className="space-y-2">
                        {/* User message */}
                        <div className="px-2 py-1">
                          <div className={`p-3 rounded-lg ${
                            theme === "dark" ? "bg-primary/20" : "bg-primary/10"
                          } rounded-tr-sm w-full`}>
                            <div className="flex items-start gap-2">
                              {userImageUrl ? (
                                <Image
                                  src={userImageUrl}
                                  alt={userName}
                                  width={24}
                                  height={24}
                                  className="w-6 h-6 rounded-full flex-shrink-0"
                                />
                              ) : (
                                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                                  theme === "dark" ? "bg-primary/40 text-white" : "bg-primary/30 text-gray-700"
                                }`}>
                                  {userName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1">
                                <div className={`${
                                  theme === "dark" ? "text-gray-200" : "text-gray-700"
                                } text-[12px] pt-0.5`}>
                                  {msg.prompt}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Assistant response */}
                        {msg.response && (
                          <div className="px-2 py-1">
                            <div className={`p-3 rounded-lg ${
                              theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"
                            } rounded-tl-sm w-full`}>
                              <div className={`text-xs ${
                                theme === "dark" ? "text-gray-400" : "text-gray-500"
                              } mb-1`}>
                                ChartSmith
                              </div>
                              <div className={`${
                                theme === "dark" ? "text-gray-200" : "text-gray-700"
                              } text-[12px] overflow-hidden`}>
                                <div className="overflow-x-auto">
                                  <ReactMarkdown
                                    components={{
                                      code: ({ className, children, ...props }) => (
                                        <code
                                          className={`${className || ''} ${
                                            theme === "dark" ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"
                                          } px-1 py-0.5 rounded text-sm break-all`}
                                          {...props}
                                        >
                                          {children}
                                        </code>
                                      ),
                                      pre: ({ children }) => (
                                        <pre className={`${
                                          theme === "dark" ? "bg-gray-900" : "bg-gray-50"
                                        } p-3 rounded-lg overflow-x-auto my-2 max-w-full`}>
                                          {children}
                                        </pre>
                                      ),
                                    }}
                                  >
                                    {msg.response || ""}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state - only show if no messages at all */}
                {messages.length === 0 && initialMessages.length === 0 && (
                  <div className={`px-4 py-8 text-center ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                    <p className="text-lg mb-2">Start a conversation</p>
                    <p className="text-sm">Try asking about your chart files or requesting changes.</p>
                    <div className="mt-4 space-y-1 text-xs opacity-70">
                      <p>&quot;What files are in this chart?&quot;</p>
                      <p>&quot;What&apos;s the latest PostgreSQL chart version?&quot;</p>
                      <p>&quot;Create a new values.yaml file&quot;</p>
                    </div>
                  </div>
                )}

                {/* Current AI SDK messages */}
                {messages.map((message) => (
                  <div key={message.id} className="space-y-2" data-testid="chat-message">
                    {message.role === "user" ? (
                      <div className="px-2 py-1" data-testid="user-message">
                        <div className={`p-3 rounded-lg ${
                          theme === "dark" ? "bg-primary/20" : "bg-primary/10"
                        } rounded-tr-sm w-full`}>
                          <div className="flex items-start gap-2">
                            {userImageUrl ? (
                              <Image
                                src={userImageUrl}
                                alt={userName}
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                                theme === "dark" ? "bg-primary/40 text-white" : "bg-primary/30 text-gray-700"
                              }`}>
                                {userName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className={`${
                                theme === "dark" ? "text-gray-200" : "text-gray-700"
                              } text-[12px] pt-0.5`}>
                                {message.parts?.map((part, i) =>
                                  part.type === 'text' ? <span key={i}>{part.text}</span> : null
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-2 py-1" data-testid="assistant-message">
                        <div className={`p-3 rounded-lg ${
                          theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"
                        } rounded-tl-sm w-full`}>
                          <div className={`text-xs ${
                            theme === "dark" ? "text-gray-400" : "text-gray-500"
                          } mb-1 flex items-center justify-between`}>
                            <div>ChartSmith</div>
                            <div className="text-[10px] opacity-70">Rev #{revisionNumber}</div>
                          </div>
                          <div className={`${
                            theme === "dark" ? "text-gray-200" : "text-gray-700"
                          } text-[12px] markdown-content overflow-hidden`}>
                            {message.parts?.map((part, i) => {
                              if (part.type === 'text') {
                                return (
                                  <div key={i} className="overflow-x-auto">
                                    <ReactMarkdown
                                      components={{
                                        code: ({ className, children, ...props }) => (
                                          <code
                                            className={`${className || ''} ${
                                              theme === "dark" ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"
                                            } px-1 py-0.5 rounded text-sm break-all`}
                                            {...props}
                                          >
                                            {children}
                                          </code>
                                        ),
                                        pre: ({ children }) => (
                                          <pre className={`${
                                            theme === "dark" ? "bg-gray-900" : "bg-gray-50"
                                          } p-3 rounded-lg overflow-x-auto my-2 max-w-full`}>
                                            {children}
                                          </pre>
                                        ),
                                      }}
                                    >
                                      {part.text || ""}
                                    </ReactMarkdown>
                                  </div>
                                );
                              }
                              // AI SDK v5: tool parts have type like "tool-toolName" - hide from UI for cleaner UX
                              // Tool execution happens in the background; users only see the final text response
                              if (part.type.startsWith('tool-')) {
                                return null; // Don't render tool invocations
                              }
                              return null;
                            })}
                            {(!message.parts || message.parts.length === 0) && (
                              <div className="flex items-center gap-2">
                                <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
                                <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                                  generating response...
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Thinking indicator - shows when waiting for AI response */}
                {status === "submitted" && (
                  <div className="px-2 py-1">
                    <div className={`p-3 rounded-lg ${
                      theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"
                    } rounded-tl-sm w-full`}>
                      <div className={`text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      } mb-1`}>
                        ChartSmith
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                          thinking...
                        </div>
                        <button
                          className={`ml-auto text-xs px-1.5 py-0.5 rounded border ${
                            theme === "dark"
                              ? "border-dark-border text-gray-400 hover:text-gray-200"
                              : "border-gray-300 text-gray-500 hover:text-gray-700"
                          } hover:bg-dark-border/40`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            stop();
                          }}
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollingContent>

            {/* Chat input area */}
            <div className={`absolute bottom-0 left-0 right-0 ${
              theme === "dark"
                ? "bg-gray-900 border-t border-gray-800"
                : "bg-gray-50 border-t border-gray-200"
            }`}>
              <form onSubmit={handleChatSubmit} className="p-4 relative flex gap-3 items-start">
                <div className="flex-1 relative">
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Ask a question or request a change..."
                    rows={2}
                    disabled={isLoading}
                    style={{ height: 'auto', minHeight: '56px', maxHeight: '120px' }}
                    className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                      theme === "dark"
                        ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                        : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                    } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-50`}
                  />
                  <div className="absolute right-2 top-[14px]">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`p-1.5 rounded-full ${
                        isLoading
                          ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                          : theme === "dark"
                            ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className={`w-px ${theme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />

        {/* File Explorer - MIDDLE (260px fixed) */}
        <div className={`w-[260px] flex-shrink-0 overflow-hidden`}>
          <FileBrowser />
        </div>

        {/* Divider */}
        <div className={`w-px ${theme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />

        {/* Code Editor Panel - RIGHT (flex-1) */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Source/Rendered tabs */}
          <div className={`flex items-center px-2 border-b ${
            theme === "dark" ? "border-dark-border/40 bg-dark-surface/40" : "border-gray-200 bg-white"
          }`}>
            <div
              onClick={() => setView("source")}
              className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative group ${
                view === "source"
                  ? theme === "dark" ? "text-primary" : "text-primary-foreground"
                  : theme === "dark" ? "text-gray-500 hover:text-gray-300" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {view === "source" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              Source
            </div>
            <div
              onClick={() => setView("rendered")}
              className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative group ${
                view === "rendered"
                  ? theme === "dark" ? "text-primary" : "text-primary-foreground"
                  : theme === "dark" ? "text-gray-500 hover:text-gray-300" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {view === "rendered" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              Rendered
            </div>

            {/* Spacer to push pending changes to the right */}
            <div className="flex-1" />

            {/* Pending changes controls */}
            {hasPendingChanges && (
              <div className="flex items-center gap-2 px-2">
                <span className={`text-xs ${
                  theme === "dark" ? "text-yellow-400" : "text-yellow-600"
                }`}>
                  {filesWithPending.length} pending
                </span>
                <button
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className={`px-2 py-1 text-xs rounded ${
                    theme === "dark"
                      ? "bg-green-900/50 text-green-400 hover:bg-green-900/70"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  } disabled:opacity-50`}
                >
                  {isCommitting ? "..." : "Commit"}
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={isDiscarding}
                  className={`px-2 py-1 text-xs rounded ${
                    theme === "dark"
                      ? "bg-red-900/50 text-red-400 hover:bg-red-900/70"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  } disabled:opacity-50`}
                >
                  {isDiscarding ? "..." : "Discard"}
                </button>
              </div>
            )}
          </div>

          {/* Editor content */}
          <div className="flex-1 h-full overflow-auto">
            {selectedFile ? (
              view === "rendered" ? (
                // Rendered view
                (() => {
                  const renderedFile = getRenderedFile();
                  if (renderedFile) {
                    return (
                      <div key={`rendered-${renderedFile.id}`} className="h-full">
                        <Editor
                          height="100%"
                          defaultLanguage="yaml"
                          language="yaml"
                          value={renderedFile.renderedContent || ""}
                          loading={null}
                          theme={theme === "dark" ? "vs-dark" : "vs"}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 11,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2
                          }}
                        />
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 space-y-2">
                        <div>This file was not included in the rendered output</div>
                      </div>
                    );
                  }
                })()
              ) : (
                // Source view - show contentPending if available (for pending changes), otherwise content
                <div key={`source-${selectedFile.id}`} className="h-full">
                  <Editor
                    height="100%"
                    language={getLanguageFromPath(selectedFile.filePath)}
                    value={selectedFile.contentPending || selectedFile.content || ""}
                    loading={null}
                    theme={theme === "dark" ? "vs-dark" : "vs"}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 11,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2
                    }}
                  />
                </div>
              )
            ) : (
              // No file selected
              <div className={`flex flex-col items-center justify-center h-full text-sm ${
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              }`}>
                <div>Select a file to view its contents</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </EditorLayout>
  );
}

