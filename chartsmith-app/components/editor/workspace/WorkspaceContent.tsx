"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditorView } from "@/hooks/useEditorView";
import { EditorLayout } from "@/components/editor/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/editor/workspace/WorkspaceContainer";
import { ChatContainer } from "@/components/editor/chat/ChatContainer";
import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { Message, CentrifugoMessageData } from "@/components/editor/types";

import { Workspace, WorkspaceFile } from "@/lib/types/workspace";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "@/components/editor/chat/ChatMessage";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { sendChatMessageAction } from "@/lib/workspace/actions/send-chat-message";
import { Centrifuge } from "centrifuge";
import { PromptInput } from "@/components/PromptInput";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { logger } from "@/lib/utils/logger";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  workspaceId: string;
}

export function WorkspaceContent({ initialWorkspace, workspaceId }: WorkspaceContentProps) {
  const { session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const { isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | undefined>();
  const [editorContent, setEditorContent] = useState<string>("");
  const [showClarificationInput, setShowClarificationInput] = useState(false);

  const followMode = true; // Always true for now
  const [centrifugoToken, setCentrifugoToken] = useState<string | null>(null);
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const hasConnectedRef = useRef(false);

  const { view, toggleView, updateFileSelection } = useEditorView(
    usePathname()?.endsWith('/rendered') ? 'rendered' : 'source'
  );

  const renderedFiles: WorkspaceFile[] = [];

  useEffect(() => {
    if (!session) return;
    getCentrifugoTokenAction(session).then(setCentrifugoToken);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    getWorkspaceMessagesAction(session, workspaceId).then(messages => {
      setMessages(messages);
    });
  }, [session, workspaceId]); // Include workspaceId since we need to reload messages when it changes

  useEffect(() => {
    // Don't include messages in deps to avoid infinite loop with streaming updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (!centrifugoToken || !session || hasConnectedRef.current || !workspace) {
      return;
    }

    if (!centrifugeRef.current) {
      centrifugeRef.current = new Centrifuge(process.env.NEXT_PUBLIC_CENTRIFUGO_ADDRESS!, {
        debug: true,
        token: centrifugoToken,
      });

      const cf = centrifugeRef.current;

      cf.on("connected", () => {});
      cf.on("disconnected", () => {});
      cf.on("error", (ctx) => {
        logger.error("Centrifugo error", { ctx });
      });
    }

    const cf = centrifugeRef.current;
    const channel = `${workspace?.id}#${session.user.id}`;
    const sub = cf.newSubscription(channel);

    sub.on("publication", (message: { data: CentrifugoMessageData }) => {
      const isWorkspaceUpdatedEvent = message.data.workspace;

      if (!isWorkspaceUpdatedEvent) {
        const { message: chatMessage } = message.data;

        if (!chatMessage?.id || !chatMessage.prompt) {
          console.warn("Invalid chat message received:", chatMessage);
          return;
        }

        setMessages((prevMessages) => {
          const index = prevMessages.findIndex((m) => m.id === chatMessage.id);
          if (index === -1) {
            const newMessages = [...prevMessages, {
              id: chatMessage.id,
              prompt: chatMessage.prompt,
              response: chatMessage.response,
              isComplete: message.data.is_complete === true,
              isApplied: chatMessage.is_applied === true || message.data.is_applied === true,
              isApplying: chatMessage.is_applying === true || message.data.is_applying === true,
              isIgnored: chatMessage.is_ignored === true || message.data.is_ignored === true,
            }];
            return newMessages;
          }
          const newMessages = [...prevMessages];
          newMessages[index] = {
            id: chatMessage.id,
            prompt: chatMessage.prompt,
            response: chatMessage.response,
            isComplete: message.data.is_complete === true,
            isApplied: chatMessage.is_applied === true || message.data.is_applied === true,
            isApplying: chatMessage.is_applying === true || message.data.is_applying === true,
            isIgnored: chatMessage.is_ignored === true || message.data.is_ignored === true,
          };
          return newMessages;
        });

      } else {
        const newWorkspace = message.data.workspace;
        if (newWorkspace) {
          // Preserve existing messages when updating workspace
          const hadIncompleteRevision = workspace.incompleteRevisionNumber !== undefined;

          setWorkspace(prev => {
            // Deep copy the incoming charts to ensure we capture all nested file updates
            const updatedCharts = newWorkspace.charts ? newWorkspace.charts.map(chart => ({
              id: chart.id,
              name: chart.name,
              files: chart.files ? chart.files.map(f => ({
                id: f.id || '',
                filePath: f.filePath,
                content: f.content || ''
              })) : []
            })) : [];

            const updated: Workspace = {
              id: newWorkspace.id,
              createdAt: new Date(newWorkspace.created_at),
              lastUpdatedAt: new Date(newWorkspace.last_updated_at),
              name: newWorkspace.name,
              files: newWorkspace.files ? newWorkspace.files.map(f => {
                if (!f.filePath) {
                  console.warn("File missing filePath in Centrifugo update:", f);
                  return null;
                }
                return {
                  id: f.id || '',
                  filePath: f.filePath,
                  content: f.content || ''
                } as WorkspaceFile;
              }).filter((f): f is WorkspaceFile => f !== null) : prev.files,
              charts: updatedCharts,
              currentRevisionNumber: newWorkspace.current_revision,
              incompleteRevisionNumber: newWorkspace.incomplete_revision_number
            };

            return updated;
          });

          // If we had an incomplete revision before but not after, refresh messages,
          // this is how we ge the message to stop showing a spinner
          if (hadIncompleteRevision && !newWorkspace.incomplete_revision_number && session) {
            getWorkspaceMessagesAction(session, workspaceId).then(updatedMessages => {
              setMessages(updatedMessages);
            });
          }
        }
      }
    });    sub.on("subscribed", () => {});
    sub.on("error", (ctx) => {
      logger.error("Centrifugo subscription error", { ctx });
    });

    sub.subscribe();
    cf.connect();
    hasConnectedRef.current = true;

    return () => {
      hasConnectedRef.current = false;
      cf.disconnect();
      centrifugeRef.current = null;
    };
  }, [centrifugoToken, session, workspace, setWorkspace, workspaceId]);

  // Track previous workspace state for follow mode
  const prevWorkspaceRef = React.useRef<Workspace | null>(null);

  // Handle auto-selecting new files and content updates in follow mode
  useEffect(() => {
    if (!followMode || !workspace) {
      return;
    }

    // Helper to get all files including those in charts
    const getAllFiles = (workspace: Workspace): WorkspaceFile[] => {
      const chartFiles = workspace.charts.flatMap(chart => chart.files);
      return [...workspace.files, ...chartFiles];
    };

    const currentFiles = getAllFiles(workspace);
    const prevFiles = prevWorkspaceRef.current ? getAllFiles(prevWorkspaceRef.current) : [];

    // Find new or modified files
    const newOrModifiedFile = currentFiles.find(currentFile => {
      const prevFile = prevFiles.find(p => p.filePath === currentFile.filePath);
      return !prevFile || prevFile.content !== currentFile.content;
    });

    if (newOrModifiedFile) {

      setSelectedFile(newOrModifiedFile);
      setEditorContent(newOrModifiedFile.content || "");
      updateFileSelection({
        name: newOrModifiedFile.filePath.split('/').pop() || newOrModifiedFile.filePath,
        path: newOrModifiedFile.filePath,
        content: newOrModifiedFile.content || "",
        type: 'file' as const
      });
    }

    prevWorkspaceRef.current = workspace;
  }, [workspace, followMode, updateFileSelection]);

  // Keep editor content in sync with selected file's content
  useEffect(() => {
    if (selectedFile && workspace?.files) {
      const currentFile = workspace.files.find((f) => f.filePath === selectedFile.filePath);
      if (currentFile && currentFile.content !== editorContent) {
        setEditorContent(currentFile.content || "");
      }
    }
  }, [workspace?.files, selectedFile, editorContent]);

  const handleSendMessage = async (message: string) => {
    if (!session || !workspace) return;
    const m = await sendChatMessageAction(session, workspace.id, message);
    setMessages((prevMessages) => [...prevMessages, m]);
  };

  const handleGenerateChart = async () => {
    if (!session || !workspace) return;
    const updatedWorkspace = await createRevisionAction(session, workspace.id);
    if (!updatedWorkspace) return;

    setWorkspace(updatedWorkspace);
    setIsFileTreeVisible(true);

    // Refresh messages
    const updatedMessages = await getWorkspaceMessagesAction(session, workspace.id);
    setMessages(updatedMessages);
  }

  const handleApplyChanges = async (message: Message) => {
    if (!session || !workspace) return;
    const updatedWorkspace = await createRevisionAction(session, workspace.id, message.id);
    if (!updatedWorkspace) return;

    setWorkspace(updatedWorkspace);

    // Refresh messages
    const updatedMessages = await getWorkspaceMessagesAction(session, workspace.id);
    setMessages(updatedMessages);
    return;
  };

  // Reference for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle window resize for mobile viewport height
  // Handle window resize for mobile viewport height
  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []); // Empty dependency array since this effect only handles window resize

  // Handle chat transition end
  useEffect(() => {
    const chatContainer = document.querySelector('.chat-container-wrapper');
    if (!chatContainer) return;

    const handleTransitionEnd = () => {
      scrollToBottom();
    };

    chatContainer.addEventListener('transitionend', handleTransitionEnd);
    return () => {
      chatContainer.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, []);

  const showEditor = workspace?.currentRevisionNumber > 0 || workspace?.incompleteRevisionNumber;

  if (!session) return null;

  // return null;

  // Show chat-only view when there's no revision yet
  if (!showEditor) {
    return (
      <EditorLayout>
        <div className="h-full w-full overflow-auto transition-all duration-300 ease-in-out">
          <div className="px-4 w-full max-w-3xl py-8 pb-16 mx-auto">
            <Card className="p-6 w-full border-dark-border/40 shadow-lg">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id || index}
                    message={message}
                    messages={messages}
                    session={session}
                    workspaceId={workspaceId}
                    showActions={index === messages.length - 1}
                    setMessages={setMessages}
                  />
                ))}
                {messages[messages.length - 1]?.isComplete && !showClarificationInput && (
                  <div className="mt-8 flex justify-center space-x-4">
                    <Button
                      onClick={() => handleGenerateChart()}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      Continue to the editor
                    </Button>
                    <Button
                      onClick={() => setShowClarificationInput(true)}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      Provide clarification
                    </Button>
                  </div>
                )}
                {showClarificationInput && (
                  <div className="mt-8">
                    <PromptInput
                      onSubmit={(message) => {
                        handleSendMessage(message);
                        setShowClarificationInput(false);
                      }}
                      className="w-full"
                      label="Add additional clarifying prompts"
                    />
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </Card>
          </div>
        </div>
      </EditorLayout>
    );
  }

  const handleViewChange = () => {
    const newView = view === "source" ? "rendered" : "source";
    const newFiles = newView === "rendered" ? renderedFiles.map(file => ({
      name: file.filePath ? file.filePath.split('/').pop() || file.filePath : 'unnamed',
      path: file.filePath || '',
      content: file.content || '',
      type: 'file' as const
    })) : workspace.files.map(file => ({
      name: file.filePath ? file.filePath.split('/').pop() || file.filePath : 'unnamed',
      path: file.filePath || '',
      content: file.content || '',
      type: 'file' as const
    }));

    // Clear selected file and editor content when switching to rendered view
    if (newView === "rendered") {
      setSelectedFile(undefined);
      setEditorContent("");
    }

    toggleView(newFiles);
  };

  const handleFileSelect = (file: WorkspaceFile) => {
    if (!('content' in file)) {
      console.warn("Selected file has no content property:", file);
    }
    setSelectedFile(file);
    setEditorContent(file.content || "");
    updateFileSelection({
      name: file.filePath.split('/').pop() || file.filePath,
      path: file.filePath,
      content: file.content || "",
      type: 'file' as const
    });
  };

  const handleFileDelete = () => {
    return;
  };

  return (
    <EditorLayout>
      <div className="flex w-full overflow-hidden relative">
        <div className={`chat-container-wrapper transition-all duration-300 ease-in-out absolute ${
          (!workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber) || (workspace.currentRevisionNumber === 0 && !workspace.incompleteRevisionNumber) ? 'inset-0 flex justify-center' : 'left-0 top-0 bottom-0'
        }`}>
          <div className={`${(!workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber) || (workspace.currentRevisionNumber === 0 && !workspace.incompleteRevisionNumber) ? 'w-full max-w-3xl px-4' : 'w-[400px]'}`}>
            <ChatContainer
              messages={messages}
              onSendMessage={handleSendMessage}
              onApplyChanges={handleApplyChanges}
              session={session}
              workspaceId={workspaceId}
              setMessages={setMessages}
            />
          </div>
        </div>
        {showEditor && (
          <div className="flex-1 h-full translate-x-[400px] transition-opacity duration-100 ease-in-out opacity-0 animate-fadeIn">
            <WorkspaceContainer
              view={view}
              onViewChange={handleViewChange}
              files={workspace.files}
              charts={workspace.charts}
              renderedFiles={renderedFiles}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onFileDelete={handleFileDelete}
              editorContent={editorContent}
              onEditorChange={(value) => setEditorContent(value ?? "")}
              isFileTreeVisible={isFileTreeVisible}
            />
          </div>
        )}
      </div>
    </EditorLayout>
  );
}
