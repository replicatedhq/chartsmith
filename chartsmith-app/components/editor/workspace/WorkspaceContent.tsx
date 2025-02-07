"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useEditorView } from "@/hooks/useEditorView";
import { EditorLayout } from "@/components/editor/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/editor/workspace/WorkspaceContainer";
import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { Message, CentrifugoMessageData, RawPlan, RawWorkspace, RawChatMessage, RawRevision } from "@/components/editor/types";
import { Plan, Workspace, WorkspaceFile } from "@/lib/types/workspace";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { Centrifuge, Options } from "centrifuge";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { logger } from "@/lib/utils/logger";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { PlanOnlyLayout } from "../layout/PlanOnlyLayout";
import { PlanContent } from "./PlanContent";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { useCommandMenu } from '@/contexts/CommandMenuContext';
import { CommandMenuWrapper } from "@/components/CommandMenuWrapper";
import { Send } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ChatContainer } from "../chat/ChatContainer";
import { acceptPatchAction } from "@/lib/workspace/actions/accept-patch";
import { rejectPatchAction } from "@/lib/workspace/actions/reject-patch";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  workspaceId: string;
  onOpenCommandMenu?: () => void;
}

export function WorkspaceContent({ initialWorkspace, workspaceId }: WorkspaceContentProps) {
  const { theme } = useTheme();
  const { session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const { isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | undefined>();
  const [editorContent, setEditorContent] = useState<string>("");
  const [centrifugoToken, setCentrifugoToken] = useState<string | null>(null);
  const { openCommandMenu } = useCommandMenu();
  const [chatInput, setChatInput] = useState("");
  const { view, toggleView, updateFileSelection } = useEditorView(
    usePathname()?.endsWith('/rendered') ? 'rendered' : 'source'
  );
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const handlersRef = useRef<{
    onMessage: ((message: { data: CentrifugoMessageData }) => void) | null;
  }>({ onMessage: null });

  useEffect(() => {
    console.log('Initial workspace loaded:', {
      id: initialWorkspace.id,
      fileCount: initialWorkspace.files.length,
      chartFileCount: initialWorkspace.charts?.reduce((acc, chart) => acc + chart.files.length, 0),
      filesWithPatches: initialWorkspace.files.filter(f => f.pendingPatch).length,
      chartFilesWithPatches: initialWorkspace.charts?.reduce((acc, chart) =>
        acc + chart.files.filter(f => f.pendingPatch).length, 0
      )
    });
  }, [initialWorkspace]);

  const handleFileSelect = useCallback((file: WorkspaceFile) => {
    setSelectedFile({
      ...file,
      content: file.content || ""
    });
    setEditorContent(file.content || "");
    updateFileSelection({
      name: file.filePath.split('/').pop() || file.filePath,
      path: file.filePath,
      content: file.content || "",
      type: 'file' as const
    });
  }, [setSelectedFile, setEditorContent, updateFileSelection]);

  const handleFileDelete = useCallback(() => {
    return;
  }, []);

  const followMode = true;

  const renderedFiles: WorkspaceFile[] = workspace?.files || [];

  useEffect(() => {
    if (!session) return;
    getCentrifugoTokenAction(session).then(setCentrifugoToken);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    getWorkspaceMessagesAction(session, workspaceId).then(messages => {
      setMessages(messages);
    });
  }, [session, workspaceId]);

  const handlePlanUpdated = React.useCallback((plan: RawPlan | Plan) => {
    const p: Plan = 'createdAt' in plan && typeof plan.createdAt === 'string' ? {
      id: plan.id,
      description: plan.description,
      status: plan.status,
      workspaceId: plan.workspaceId,
      chatMessageIds: plan.chatMessageIds,
      createdAt: new Date(plan.createdAt),
      actionFiles: plan.actionFiles,
      isComplete: plan.isComplete || false
    } : plan as Plan;

    setWorkspace(currentWorkspace => {
      if (p.status === 'pending') {
        const updatedCurrentPlans = currentWorkspace.currentPlans.map(existingPlan => {
          if (existingPlan.id === p.id) {
            return p;
          }
          return { ...existingPlan, status: 'ignored' };
        });

        if (!updatedCurrentPlans.some(plan => plan.id === p.id)) {
          updatedCurrentPlans.unshift(p);
        }

        return {
          ...currentWorkspace,
          currentPlans: updatedCurrentPlans,
          previousPlans: currentWorkspace.previousPlans.map(p => ({ ...p, status: 'ignored' }))
        };
      }

      const existingPlanIndex = currentWorkspace.currentPlans.findIndex(plan => plan.id === p.id);
      const updatedCurrentPlans = [...currentWorkspace.currentPlans];

      if (existingPlanIndex !== -1) {
        updatedCurrentPlans[existingPlanIndex] = p;
      } else {
        updatedCurrentPlans.unshift(p);
      }

      return {
        ...currentWorkspace,
        currentPlans: updatedCurrentPlans,
        previousPlans: currentWorkspace.previousPlans
      };
    });

    if (session && (p.status === 'review' || p.status === 'pending')) {
      getWorkspaceMessagesAction(session, workspaceId).then(updatedMessages => {
        setMessages(updatedMessages);
      });
    }
  }, [session, workspaceId, setMessages]);

  const handleRevisionCreated = useCallback(async (revision: RawRevision) => {
    if (!session || !revision.workspaceId) return;

    const freshWorkspace = await getWorkspaceAction(session, revision.workspaceId);
    if (freshWorkspace) {
      setWorkspace(freshWorkspace);

      const updatedMessages = await getWorkspaceMessagesAction(session, revision.workspaceId);
      setMessages(updatedMessages);
    }
  }, [session, setMessages, setWorkspace]);

  const handleChatMessageUpdated = useCallback((chatMessage: RawChatMessage) => {
    setMessages?.(prev => {
      const tempMessageIndex = prev.findIndex(m =>
        m.id.startsWith('msg-temp-') && m.prompt === chatMessage.prompt
      );

      if (tempMessageIndex !== -1) {
        const newMessages = [...prev];
        newMessages[tempMessageIndex] = {
          ...chatMessage,
          isComplete: chatMessage.response !== null,
          createdAt: chatMessage.createdAt ? new Date(chatMessage.createdAt) : new Date()
        };
        return newMessages;
      }

      return prev.map((m) => {
        if (m.id === chatMessage.id) {
          return {
            ...m,
            ...chatMessage,
            isComplete: chatMessage.response !== null,
            createdAt: chatMessage.createdAt ? new Date(chatMessage.createdAt) : new Date()
          };
        }
        return m;
      });
    });
  }, []);

  const handleWorkspaceUpdated = useCallback((workspace: RawWorkspace) => {
  }, []);

  const handleArtifactReceivedRef = useRef<((artifact: { path: string, content: string, pendingPatch?: string }) => void) | null>(null);

  const handleArtifactReceived = useCallback((artifact: { path: string, content: string, pendingPatch?: string }) => {
    console.log('Received artifact:', {
      path: artifact.path,
      contentLength: artifact.content.length,
      hasPatch: !!artifact.pendingPatch,
      patchLength: artifact.pendingPatch?.length
    });

    setWorkspace(currentWorkspace => {
      const existingWorkspaceFile = currentWorkspace.files?.find(f => f.filePath === artifact.path);
      const chartWithFile = currentWorkspace.charts?.find(chart =>
        chart.files.some(f => f.filePath === artifact.path)
      );

      console.log('Existing file check:', {
        hasExistingFile: !!existingWorkspaceFile,
        hasChartWithFile: !!chartWithFile
      });

      if (!existingWorkspaceFile && !chartWithFile) {
        const newFile = {
          id: `file-${Date.now()}`,
          filePath: artifact.path,
          content: artifact.content,
          pendingPatch: artifact.pendingPatch
        };

        console.log('Creating new file:', {
          id: newFile.id,
          filePath: newFile.filePath,
          contentLength: newFile.content.length,
          hasPendingPatch: !!newFile.pendingPatch
        });

        return {
          ...currentWorkspace,
          charts: currentWorkspace.charts.map((chart, index) =>
            index === 0 ? {
              ...chart,
              files: [...chart.files, newFile]
            } : chart
          )
        };
      }

      const updatedFiles = currentWorkspace.files?.map(file =>
        file.filePath === artifact.path ? {
          ...file,
          content: artifact.content,
          pendingPatch: artifact.pendingPatch
        } : file
      ) || [];

      const updatedCharts = currentWorkspace.charts?.map(chart => ({
        ...chart,
        files: chart.files.map(file =>
          file.filePath === artifact.path ? {
            ...file,
            content: artifact.content,
            pendingPatch: artifact.pendingPatch
          } : file
        )
      })) || [];

      console.log('Updated existing file:', {
        path: artifact.path,
        filesUpdated: updatedFiles.some(f => f.filePath === artifact.path),
        chartsUpdated: updatedCharts.some(c => c.files.some(f => f.filePath === artifact.path))
      });

      return {
        ...currentWorkspace,
        files: updatedFiles,
        charts: updatedCharts
      };
    });

    const file = {
      id: `file-${Date.now()}`,
      filePath: artifact.path,
      content: artifact.content,
      pendingPatch: artifact.pendingPatch
    };

    console.log('Selecting file:', {
      id: file.id,
      filePath: file.filePath,
      contentLength: file.content.length,
      hasPendingPatch: !!file.pendingPatch
    });

    handleFileSelect(file);
    setEditorContent(artifact.content);
    updateFileSelection({
      name: artifact.path.split('/').pop() || artifact.path,
      path: artifact.path,
      content: artifact.content,
      type: 'file' as const
    });
  }, [handleFileSelect, setEditorContent, updateFileSelection]);

  useEffect(() => {
    handleArtifactReceivedRef.current = handleArtifactReceived;
  }, [handleArtifactReceived]);

  const handleCentrifugoMessage = useCallback((message: { data: CentrifugoMessageData }) => {
    const isPlanUpdatedEvent = message.data.plan;
    if (isPlanUpdatedEvent) {
      handlePlanUpdated(message.data.plan!);
    }

    const isWorkspaceUpdatedEvent = message.data.workspace;
    if (isWorkspaceUpdatedEvent) {
      handleWorkspaceUpdated(message.data.workspace!);
    }

    const isChatMessageUpdatedEvent = message.data.chatMessage;
    if (isChatMessageUpdatedEvent) {
      handleChatMessageUpdated(message.data.chatMessage!);
    }

    const isRevisionCreatedEvent = message.data.revision;
    if (isRevisionCreatedEvent) {
      handleRevisionCreated(message.data.revision!);
    }

    const artifact = message.data.artifact;
    if (artifact && artifact.path && artifact.content) {
      console.log('Centrifugo artifact message:', {
        path: artifact.path,
        contentLength: artifact.content.length,
        hasPatch: !!artifact.pendingPatch,
        patchLength: artifact.pendingPatch?.length,
        rawMessage: message.data
      });
      handleArtifactReceivedRef.current?.(artifact);
    }
  }, [handlePlanUpdated, handleWorkspaceUpdated, handleChatMessageUpdated, handleRevisionCreated]);

  useEffect(() => {
    handlersRef.current.onMessage = handleCentrifugoMessage;
  }, [handleCentrifugoMessage]);

  useEffect(() => {
    if (!centrifugoToken || !session || !workspace?.id) {
      return;
    }

    if (centrifugeRef.current) {
      return;
    }

    const channel = `${workspace.id}#${session.user.id}`;
    const centrifuge = new Centrifuge(process.env.NEXT_PUBLIC_CENTRIFUGO_URL!, {
      timeout: 5000,
      token: centrifugoToken
    });

    centrifugeRef.current = centrifuge;

    centrifuge.on("connected", () => {
      logger.info("Centrifugo connected");
    });

    centrifuge.on("disconnected", (ctx) => {
      logger.warn("Centrifugo disconnected", { ctx });
      if (session) {
        getCentrifugoTokenAction(session).then(newToken => {
          if (centrifugeRef.current && newToken) {
            centrifugeRef.current.setToken(newToken);
            centrifugeRef.current.connect();
          }
        });
      }
    });

    centrifuge.on("error", (ctx) => {
      logger.error("Centrifugo error", { ctx });
    });
    centrifuge.on("connecting", () => {});

    const sub = centrifuge.newSubscription(channel, {
      data: {}
    });

    sub.on("publication", (message) => {
      handlersRef.current.onMessage?.(message);
    });

    sub.on("subscribing", (ctx) => {
      logger.info("Subscribing to channel", { channel });
    });

    sub.on("subscribed", (ctx) => {
      logger.info("Subscribed to channel", { channel });
    });

    sub.on("unsubscribed", (ctx) => {
      logger.info("Unsubscribed from channel", { channel });
    });

    sub.on("error", (ctx) => {
      logger.error("Centrifugo subscription error", { ctx });
    });

    sub.subscribe();

    try {
      centrifuge.connect();
    } catch (err) {
      logger.error("Error connecting to Centrifugo:", err);
    }

    return () => {
      try {
        if (centrifugeRef.current) {
          sub.unsubscribe();
          centrifugeRef.current.disconnect();
          centrifugeRef.current = null;
        }
      } catch (err) {
        logger.error("Error during Centrifugo cleanup:", err);
      }
    };
  }, [centrifugoToken, session, workspace?.id, handlersRef]);

  const prevWorkspaceRef = React.useRef<Workspace | null>(null);

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
        path: newOrModifiedFile.filePath,
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

  const handleSendMessage = async (message: string) => {
    if (!session || !workspace) return;

    const chatMessage = await createChatMessageAction(session, workspace.id, message);

    setMessages(prev => [...prev, chatMessage]);
  }

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  if (!session) return null;

  const handleViewChange = () => {
    const newView = view === "source" ? "rendered" : "source";
    const newFiles = newView === "rendered" ? workspace.files.map(file => ({
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

    if (newView === "rendered") {
      setSelectedFile(undefined);
      setEditorContent("");
    }

    toggleView(newFiles);
  };

  const handleFileUpdate = (updatedFile: WorkspaceFile) => {
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
  };

  const handleAcceptPatch = async () => {
    if (!session || !selectedFile?.pendingPatch) return;
    const updatedFile = await acceptPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);
    setEditorContent(updatedFile.content);
    handleFileUpdate(updatedFile);
  };

  const handleRejectPatch = () => {
    if (!session || !selectedFile?.pendingPatch) return;
    rejectPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);
  };

  const handleAcceptAllPatches = async () => {
    if (!session) return;
    const filesWithPatches = allFiles.filter(f => f.pendingPatch);
    for (const patchFile of filesWithPatches) {
      const updatedFile = await acceptPatchAction(session, patchFile.id, workspace.currentRevisionNumber);
      handleFileUpdate(updatedFile);
    }
  };

  const allFiles = [
    ...(workspace.files || []),
    ...(workspace.charts?.flatMap(chart => chart.files) || [])
  ];

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    try {
      await handleSendMessage(chatInput.trim());
      setChatInput("");
    } catch (error) {
      logger.error("Error sending message:", error);
    }
  };

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
                handlePlanUpdated={handlePlanUpdated}
              />
              ) : (
                <ChatContainer
                  messages={messages}
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
                renderedCharts={workspace.renderedCharts || []}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onFileDelete={handleFileDelete}
                editorContent={editorContent}
                onEditorChange={(value) => setEditorContent(value ?? "")}
                isFileTreeVisible={isFileTreeVisible}
                onCommandK={openCommandMenu}
                onFileUpdate={handleFileUpdate}
              />
            </div>
          );
        })()}
      </div>
      <CommandMenuWrapper />
    </EditorLayout>
  );
}
