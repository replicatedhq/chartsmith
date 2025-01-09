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
import { FileNode } from "@/lib/types/files";
import { Workspace } from "@/lib/types/workspace";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "@/components/editor/chat/ChatMessage";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { sendChatMessageAction } from "@/lib/workspace/actions/send-chat-message";
import { Centrifuge } from "centrifuge";
import { PromptInput } from "@/components/PromptInput";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  workspaceId: string;
}

export function WorkspaceContent({ initialWorkspace, workspaceId }: WorkspaceContentProps) {
  const { session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const { isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();
  const [editorContent, setEditorContent] = useState<string>("");
  const [showClarificationInput, setShowClarificationInput] = useState(false);

  const followMode = true; // Always true for now
  const [centrifugoToken, setCentrifugoToken] = useState<string | null>(null);
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const hasConnectedRef = useRef(false);

  const { view, toggleView, updateFileSelection } = useEditorView(
    usePathname()?.endsWith('/rendered') ? 'rendered' : 'source'
  );

  const renderedFiles: FileNode[] = [];

  useEffect(() => {
    if (!session) return;
    getCentrifugoTokenAction(session).then(setCentrifugoToken);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    getWorkspaceMessagesAction(session, workspaceId).then(messages => {
      console.log("Initial messages loaded:", messages);
      setMessages(messages);
    });
  }, [session, workspaceId]); // Remove workspace from dependencies to prevent reloading

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

      cf.on("connected", () => {
        // console.log("Connected to Centrifugo");
      });

      cf.on("disconnected", () => {
        // console.log("Disconnected from Centrifugo");
      });

      cf.on("error", (ctx) => {
        console.error("Centrifugo error:", ctx);
      });
    }

    const cf = centrifugeRef.current;
    const channel = `${workspace?.id}#${session.user.id}`;
    const sub = cf.newSubscription(channel);

    sub.on("publication", (message: { data: CentrifugoMessageData }) => {
      console.log("Received message:", message.data);
      const isWorkspaceUpdatedEvent = message.data.workspace;

      if (!isWorkspaceUpdatedEvent) {
        const { message: chatMessage } = message.data;
        if (!chatMessage?.id || !chatMessage.prompt) {
          console.log("Invalid chat message format:", chatMessage);
          return;
        }

        // Convert snake_case to camelCase for our frontend types
        const normalizedMessage: Message = {
          id: chatMessage.id,
          prompt: chatMessage.prompt,
          response: chatMessage.response,
          fileChanges: chatMessage.fileChanges,
          isComplete: message.data.is_complete === true,  // Only true if explicitly set to true
        };

        setMessages((prevMessages) => {
          const index = prevMessages.findIndex((m) => m.id === normalizedMessage.id);
          if (index === -1) {
            const newMessages = [...prevMessages, normalizedMessage];
            return newMessages;
          }
          const newMessages = [...prevMessages];
          newMessages[index] = normalizedMessage;
          return newMessages;
        });

      } else {
        const newWorkspace = message.data.workspace;
        if (newWorkspace) {
          // Preserve existing messages when updating workspace
          setWorkspace(prev => {
            const updated: Workspace = {
              id: newWorkspace.id,
              createdAt: new Date(newWorkspace.created_at),
              lastUpdatedAt: new Date(newWorkspace.last_updated_at),
              name: newWorkspace.name,
              files: newWorkspace.files || prev.files,
              currentRevisionNumber: newWorkspace.current_revision,
              incompleteRevisionNumber: newWorkspace.incomplete_revision_number
            };
            return updated;
          });
        }
      }
    });

    sub.on("subscribed", () => {
      // console.log(`Subscribed to channel ${channel}`);
    });

    sub.on("error", (ctx) => {
      console.error(`Subscription error for channel ${channel}:`, ctx);
    });

    sub.subscribe();
    cf.connect();
    hasConnectedRef.current = true;

    return () => {
      hasConnectedRef.current = false;
      cf.disconnect();
      centrifugeRef.current = null;
    };
  }, [centrifugoToken, session, workspace, setWorkspace]);

  // Handle auto-selecting new files in follow mode
  useEffect(() => {
    if (followMode && workspace?.files.length) {
      const lastFile = workspace.files[workspace.files.length - 1];
      const fileNode: FileNode = {
        name: lastFile.name,
        path: lastFile.path,
        content: lastFile.content,
        type: 'file'
      };
      setSelectedFile(fileNode);
      setEditorContent(lastFile.content || "");
      updateFileSelection(fileNode);
    }
  }, [workspace?.files.length, followMode, updateFileSelection, workspace?.files]);

  // Keep editor content in sync with selected file's content
  useEffect(() => {
    if (selectedFile && workspace) {
      const currentFile = workspace.files.find((f) => f.path === selectedFile.path);
      if (currentFile && currentFile.content !== editorContent) {
        const fileNode: FileNode = {
          name: currentFile.name,
          path: currentFile.path,
          content: currentFile.content,
          type: 'file'
        };
        setEditorContent(fileNode.content || "");
      }
    }
  }, [workspace, selectedFile, editorContent]);

  const handleSendMessage = async (message: string) => {
    if (!session || !workspace) return;
    const m = await sendChatMessageAction(session, workspace.id, message);
    setMessages((prevMessages) => [...prevMessages, m]);
  };

  const handleGenerateChart = async () => {
    if (!session || !workspace) return;
    const updatedWorkspace = await createRevisionAction(session, workspace.id);
    if (!updatedWorkspace) return;

    console.log(updatedWorkspace);
    setWorkspace(updatedWorkspace);
    setIsFileTreeVisible(true);
  }

  const handleApplyChanges = async (message: Message) => {
    if (!session || !workspace) return;
    const updatedWorkspace = await createRevisionAction(session, workspace.id, message.id);
    if (!updatedWorkspace) return;

    console.log(updatedWorkspace);
    setWorkspace(updatedWorkspace);
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
                    session={session}
                    workspaceId={workspaceId}
                    showActions={index === messages.length - 1}
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
    const newFiles = newView === "rendered" ? renderedFiles : workspace.files.map(file => ({
      name: file.name,
      path: file.path,
      content: file.content,
      type: 'file' as const
    }));
    toggleView(newFiles);
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setEditorContent(file.content || "");
    updateFileSelection(file);
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
            />
          </div>
        </div>
        {showEditor && (
          <div className="flex-1 h-full translate-x-[400px] transition-opacity duration-100 ease-in-out opacity-0 animate-fadeIn">
            <WorkspaceContainer
              view={view}
              onViewChange={handleViewChange}
              files={workspace.files.map(file => ({
                name: file.name,
                path: file.path,
                content: file.content,
                type: 'file' as const
              }))}
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
