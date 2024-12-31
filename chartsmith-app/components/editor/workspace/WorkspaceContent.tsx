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
import { Message, RawMessage } from "@/components/editor/types";
import { FileNode } from "@/lib/types/files";
import { Workspace } from "@/lib/types/workspace";
import { Card } from "@/components/ui/Card";
import { ChatMessage } from "@/components/editor/chat/ChatMessage";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { sendChatMessageAction } from "@/lib/workspace/actions/send-chat-message";
import { Centrifuge } from "centrifuge";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  workspaceId: string;
}

export function WorkspaceContent({ initialWorkspace, workspaceId }: WorkspaceContentProps) {
  const { session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const { isChatVisible, isFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();
  const [editorContent, setEditorContent] = useState<string>("");

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
    console.log("Loading initial messages...");
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

    sub.on("publication", (message: { data: { workspace?: Workspace; message?: RawMessage } }) => {
      const isWorkspaceUpdatedEvent = message.data.workspace;

      if (!isWorkspaceUpdatedEvent) {
        const chatMessage = message.data.message;
        if (!chatMessage?.id || !chatMessage.prompt || typeof chatMessage.is_complete !== 'boolean') {
          return;
        }

        // Convert snake_case to camelCase for our frontend types
        const normalizedMessage: Message = {
          ...chatMessage,
          isComplete: chatMessage.is_complete,
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
          setWorkspace(prev => ({
            ...newWorkspace,
            files: newWorkspace.files || prev.files
          }));
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

  // Keep messages visible regardless of workspace state
  const chatContent = (
    <div className="space-y-4">
      {messages.map((message, index) => {
        return <ChatMessage key={message.id || index} message={message} />;
      })}
    </div>
  );

  // Show chat-only view when workspace has no files yet
  if (!workspace || workspace.files.length === 0) {
    return (
      <EditorLayout>
        <div className="flex justify-center h-full w-full pt-8">
          <div className="px-4 w-full max-w-3xl">
            <Card className="p-6 w-full">
              {chatContent}
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

  const handleUndoChanges = () => {
    return;
  };

  return (
    <EditorLayout>
      <div className="flex w-full overflow-hidden">
        {isChatVisible && (
          <ChatContainer
            messages={messages}
            onSendMessage={handleSendMessage}
            onUndoChanges={handleUndoChanges}
          />
        )}
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
    </EditorLayout>
  );
}
