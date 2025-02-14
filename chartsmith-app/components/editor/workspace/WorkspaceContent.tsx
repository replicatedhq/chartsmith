"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { EditorView, useEditorView } from "@/hooks/useEditorView";
import { EditorLayout } from "@/components/editor/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/editor/workspace/WorkspaceContainer";
import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { Message } from "@/components/editor/types";
import { Plan, Workspace, WorkspaceFile, RenderedFile } from "@/lib/types/workspace";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { PlanContent } from "./PlanContent";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { useCommandMenu } from '@/contexts/CommandMenuContext';
import { CommandMenuWrapper } from "@/components/CommandMenuWrapper";
import { useTheme } from "@/contexts/ThemeContext";
import { ChatContainer } from "../chat/ChatContainer";
import type { editor } from "monaco-editor";
import { getWorkspaceRenderedFilesAction } from "@/lib/workspace/get-workspace-rendered-files";
import { useCentrifugo } from "@/hooks/useCentrifugo";
import { logger } from "@/lib/utils/logger";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  workspaceId: string;
  onOpenCommandMenu?: () => void;
}

export function WorkspaceContent({ initialWorkspace, workspaceId }: WorkspaceContentProps) {
  const { theme } = useTheme();
  const { session } = useSession();
  const { isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();
  const { openCommandMenu } = useCommandMenu();
  const { view, setView, updateFileSelection } = useEditorView(
    usePathname()?.endsWith('/rendered') ? 'rendered' : 'source'
  );

  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | undefined>();
  const [editorContent, setEditorContent] = useState<string>("");
  const [workspaceRenders, setWorkspaceRenders] = useState<any[]>([]);
  const [renderedFiles, setRenderedFiles] = useState<RenderedFile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevWorkspaceRef = useRef<Workspace | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleFileSelect = useCallback((file: WorkspaceFile) => {
    setSelectedFile({
      ...file,
      content: file.content || ""
    });
    setEditorContent(file.content || "");
    updateFileSelection({
      name: file.filePath.split('/').pop() || file.filePath,
      filePath: file.filePath,
      content: file.content || "",
      type: 'file' as const
    });
    if (view === 'rendered') {
      setView('source');
    }
  }, [updateFileSelection, view, setView]);

  // Initialize Centrifugo connection and message handling
  useCentrifugo({
    session,
    workspace,
    setWorkspace,
    setMessages,
    setWorkspaceRenders,
    handleFileSelect
  });

  const handleFileDelete = useCallback(() => {
    return;
  }, []);

  const followMode = true;

  useEffect(() => {
    if (!session) return;
    getWorkspaceMessagesAction(session, workspaceId).then(messages => {
      setMessages(messages);
    });
  }, [session, workspaceId]);

  useEffect(() => {
    if (!session || !workspace) return;

    getWorkspaceRenderedFilesAction(session, workspace.id)
      .then(files => {
        setRenderedFiles(files);
      })
      .catch(err => {
        logger.error("Failed to load rendered charts", { err });
      });
  }, [session, workspace?.id, workspace]);

  useEffect(() => {
    if (!followMode || !workspace) {
      return;
    }

    const getAllFiles = (workspace: Workspace): WorkspaceFile[] => {
      const chartFiles = workspace.charts.flatMap(chart => chart.files);
      return [...workspace.files, ...chartFiles];
    };

    const currentFiles = getAllFiles(workspace);
    const prevFiles = prevWorkspaceRef.current ? getAllFiles(prevWorkspaceRef.current) : [];

    const newOrModifiedFile = currentFiles.find(currentFile => {
      const prevFile = prevFiles.find(p => p.filePath === currentFile.filePath);
      return !prevFile || prevFile.content !== currentFile.content;
    });

    if (newOrModifiedFile) {
      setSelectedFile(newOrModifiedFile);
      setEditorContent(newOrModifiedFile.content || "");
      updateFileSelection({
        name: newOrModifiedFile.filePath.split('/').pop() || newOrModifiedFile.filePath,
        filePath: newOrModifiedFile.filePath,
        content: newOrModifiedFile.content || "",
        type: 'file' as const
      });
    }

    prevWorkspaceRef.current = workspace;
  }, [workspace, followMode, updateFileSelection]);

  useEffect(() => {
    if (selectedFile && workspace?.files) {
      const currentFile = workspace.files.find((f) => f.filePath === selectedFile.filePath);
      if (currentFile && currentFile.content !== editorContent) {
        setEditorContent(currentFile.content || "");
      }
    }
  }, [workspace?.files, selectedFile, editorContent]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!session || !workspace) return;

    const chatMessage = await createChatMessageAction(session, workspace.id, message);

    setMessages(prev => [...prev, chatMessage]);
  }, [session, workspace]);

  const handleApplyChanges = async (message: Message) => {
    if (!session || !workspace) return;

    try {
      const updatedWorkspace = await createRevisionAction(session, message.planId || workspace.id);
      if (!updatedWorkspace) return;

      if (session) {
        const freshWorkspace = await getWorkspaceAction(session, workspace.id);
        if (freshWorkspace) {
          await new Promise<void>(resolve => {
            setWorkspace(freshWorkspace);
            setTimeout(resolve, 0);
          });
        }
      }

      const updatedMessages = await getWorkspaceMessagesAction(session, workspace.id);
      setMessages(updatedMessages);
    } catch (err) {
      console.error('Error applying changes:', err);
    }
    return;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
  }, []);

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

  useEffect(() => {
    if (showEditor) {
      setIsFileTreeVisible(true);
    }
  }, [showEditor, setIsFileTreeVisible]);

  const handleFileUpdate = useCallback((updatedFile: WorkspaceFile) => {
    setWorkspace(currentWorkspace => {
      const updatedFiles = currentWorkspace.files.map(file =>
        file.id === updatedFile.id ? updatedFile : file
      );

      const updatedCharts = currentWorkspace.charts.map(chart => ({
        ...chart,
        files: chart.files.map(file =>
          file.id === updatedFile.id ? updatedFile : file
        )
      }));

      return {
        ...currentWorkspace,
        files: updatedFiles,
        charts: updatedCharts
      };
    });

    if (selectedFile?.id === updatedFile.id) {
      setSelectedFile(updatedFile);
    }
  }, [selectedFile]);

  const handleViewChange = useCallback((newView: EditorView) => {
    setView(newView);

    // When switching to rendered view, try to find matching rendered file
    if (newView === 'rendered' && selectedFile) {
      const matchingRenderedFile = renderedFiles.find(
        rf => rf.filePath === selectedFile.filePath
      );

      if (matchingRenderedFile) {
        setEditorContent(matchingRenderedFile.renderedContent);
      }
    } else if (newView === 'source' && selectedFile) {
      // Switch back to source content
      setEditorContent(selectedFile.content || '');
    }
  }, [setView, selectedFile, renderedFiles]);

  if (!session) return null;

  const isPlanOnlyView = !workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber;
  return (
    <EditorLayout>
      <div className="flex w-full overflow-hidden relative">
        <div className={`chat-container-wrapper transition-all duration-300 ease-in-out absolute ${
            (!workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber) || (workspace.currentRevisionNumber === 0 && !workspace.incompleteRevisionNumber) ? 'inset-0 flex justify-center' : 'left-0 top-0 bottom-0'
          }`}>
          <div className={`${(!workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber) || (workspace.currentRevisionNumber === 0 && !workspace.incompleteRevisionNumber) ? 'w-full max-w-3xl px-4' : 'w-[480px] h-full flex flex-col'}`}>
            <div className="flex-1 overflow-y-auto">
              {isPlanOnlyView ? (
                <PlanContent
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  session={session}
                  setMessages={setMessages}
                  workspace={workspace}
                  setWorkspace={setWorkspace}
                />
              ) : (
                <ChatContainer
                  messages={messages}
                  workspaceRenders={workspaceRenders}
                  onSendMessage={handleSendMessage}
                  onApplyChanges={handleApplyChanges}
                  session={session}
                  workspaceId={workspaceId}
                  setMessages={setMessages}
                  workspace={workspace}
                  setWorkspace={setWorkspace}
                />
              )}
            </div>
          </div>
        </div>
        {showEditor && (() => {
          const allFiles = [
            ...(workspace.files || []),
            ...(workspace.charts?.flatMap(chart => chart.files) || [])
          ];

          return (
            <div className="flex-1 h-full translate-x-[480px]">
              <WorkspaceContainer
                session={session}
                view={view}
                onViewChange={handleViewChange}
                files={allFiles}
                charts={workspace.charts || []}
                revision={workspace.currentRevisionNumber}
                renderedFiles={renderedFiles}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onFileDelete={handleFileDelete}
                editorContent={editorContent}
                onEditorChange={(value) => {
                  setEditorContent(value ?? "");
                }}
                isFileTreeVisible={isFileTreeVisible}
                onCommandK={openCommandMenu}
                onFileUpdate={handleFileUpdate}
                editorRef={editorRef}
                workspaceId={workspaceId}
              />
            </div>
          );
        })()}
      </div>
      <CommandMenuWrapper />
    </EditorLayout>
  );
}
