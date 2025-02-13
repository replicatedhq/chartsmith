"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { EditorView, useEditorView } from "@/hooks/useEditorView";
import { EditorLayout } from "@/components/editor/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/editor/workspace/WorkspaceContainer";
import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { Message, CentrifugoMessageData, RawPlan, RawWorkspace, RawChatMessage, RawRevision } from "@/components/editor/types";
import { Plan, Workspace, WorkspaceFile, RenderedFile, RenderedWorkspace, RenderedChart } from "@/lib/types/workspace";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { Centrifuge } from "centrifuge";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { logger } from "@/lib/utils/logger";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { PlanContent } from "./PlanContent";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { useCommandMenu } from '@/contexts/CommandMenuContext';
import { CommandMenuWrapper } from "@/components/CommandMenuWrapper";
import { useTheme } from "@/contexts/ThemeContext";
import { ChatContainer } from "../chat/ChatContainer";
import { RenderUpdate } from "@/lib/types/workspace";
import type { editor } from "monaco-editor";
import { getWorkspaceRenderedFilesAction } from "@/lib/workspace/get-workspace-rendered-files";
import { listWorkspaceRendersAction } from "@/lib/workspace/actions/list-workspace-renders";
import { getWorkspaceRenderAction } from "@/lib/workspace/actions/get-workspace-render";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  workspaceId: string;
  onOpenCommandMenu?: () => void;
}

const RECONNECT_DELAY_MS = 1000;

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
  const [centrifugoToken, setCentrifugoToken] = useState<string | null>(null);
  const [workspaceRenders, setWorkspaceRenders] = useState<RenderedWorkspace[]>([]);
  const [renderedFiles, setRenderedFiles] = useState<RenderedFile[]>([]);

  const centrifugeRef = useRef<Centrifuge | null>(null);
  const handlersRef = useRef<{
    onMessage: ((message: { data: CentrifugoMessageData }) => void) | null;
  }>({ onMessage: null });
  const handleArtifactReceivedRef = useRef<((artifact: { path: string, content: string, pendingPatch?: string }) => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevWorkspaceRef = useRef<Workspace | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const [isReconnecting, setIsReconnecting] = useState(false);

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

  const handleFileDelete = useCallback(() => {
    return;
  }, []);

  const followMode = true;

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
    if (!session || !workspace) return;

    listWorkspaceRendersAction(session, workspace.id)
      .then(renders => {
        setWorkspaceRenders(renders);
      })
      .catch(err => {
        logger.error("Failed to load rendered workspaces", { err });
      });
  }, [session, workspace?.id, workspace]);

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

  const handleChatMessageUpdated = useCallback((data: CentrifugoMessageData) => {
    if (!data.chatMessage) {
      return;
    }

    const chatMessage = data.chatMessage;

    setMessages(prev => {
      const newMessages = [...prev];
      const index = newMessages.findIndex(m => m.id === chatMessage.id);

      // Convert the raw message to our Message type
      const message: Message = {
        id: chatMessage.id,
        prompt: chatMessage.prompt,
        response: chatMessage.responseRenderId ? "doing the render now..." : chatMessage.response,
        isComplete: chatMessage.isComplete,
        isApplied: chatMessage.isApplied,
        isApplying: chatMessage.isApplying,
        isIgnored: chatMessage.isIgnored,
        isCanceled: chatMessage.isCanceled,
        createdAt: new Date(chatMessage.createdAt),
        workspaceId: chatMessage.workspaceId,
        planId: chatMessage.planId,
        userId: chatMessage.userId,
        isIntentComplete: chatMessage.isIntentComplete,
        intent: chatMessage.intent,
        followupActions: chatMessage.followupActions,
        responseRenderId: chatMessage.responseRenderId,
      };

      if (index >= 0) {
        newMessages[index] = message;
      } else {
        newMessages.push(message);
      }
      return newMessages;
    });
  }, []);

  const handleWorkspaceUpdated = useCallback((workspace: RawWorkspace) => {
  }, []);

  const handleArtifactReceived = useCallback((artifact: { path: string, content: string, pendingPatch?: string }) => {
    setWorkspace(currentWorkspace => {
      const existingWorkspaceFile = currentWorkspace.files?.find(f => f.filePath === artifact.path);
      const chartWithFile = currentWorkspace.charts?.find(chart =>
        chart.files.some(f => f.filePath === artifact.path)
      );

      if (!existingWorkspaceFile && !chartWithFile) {
        const newFile = {
          id: `file-${Date.now()}`,
          filePath: artifact.path,
          content: artifact.content,
          pendingPatch: artifact.pendingPatch
        };

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

    handleFileSelect(file);
    setEditorContent(artifact.content);
    updateFileSelection({
      name: artifact.path.split('/').pop() || artifact.path,
      filePath: artifact.path,
      content: artifact.content,
      type: 'file' as const
    });
  }, [handleFileSelect, setEditorContent, updateFileSelection]);

  useEffect(() => {
    handleArtifactReceivedRef.current = handleArtifactReceived;
  }, [handleArtifactReceived]);

  const handleRenderUpdated = useCallback((data: CentrifugoMessageData) => {
    if (!data.renderedFile) {
      return;
    }

    if (!data.renderedFile.id) {
      return;
    }

    // update the workspaceRender with the new file


    // If this is the currently selected file in rendered view, update editor content
    // if (view === 'rendered' && selectedFile && selectedFile.filePath === data.renderedFile.filePath) {
    //   setEditorContent(data.renderedFile.renderedContent);
    // }
  }, [view, selectedFile]);

  const handleRenderStreamEvent = useCallback(async (data: CentrifugoMessageData) => {
    if (!session) return;
    if (data.eventType !== 'render-stream' || !data.renderChartId || !data.renderWorkspaceId) {
      return;
    }

    let renders = [...workspaceRenders];

    // if the message has a renderWorkspaceId that we don't know, fetch and add it
    if (!renders.find(render => render.id === data.renderWorkspaceId)) {
      const newWorkspaceRender = await getWorkspaceRenderAction(session, data.renderWorkspaceId);
      renders = [...renders, newWorkspaceRender];
    }

    // Now update the renders with the new stream data
    setWorkspaceRenders(renders.map(render => {
      if (render.id !== data.renderWorkspaceId) return render;

      return {
        ...render,
        charts: render.charts.map(chart => {
          if (chart.id !== data.renderChartId) return chart;

          return {
            ...chart,
            helmTemplateCommand: data.helmTemplateCommand,
            helmTemplateStderr: data.helmTemplateStderr,
            helmTemplateStdout: data.helmTemplateStdout,
            depUpdateCommand: data.depUpdateCommand,
            depUpdateStderr: data.depUpdateStderr,
            depUpdateStdout: data.depUpdateStdout,
          };
        })
      };
    }));
  }, [session, workspaceRenders]);

  const handleCentrifugoMessage = useCallback((message: { data: CentrifugoMessageData }) => {
    const eventType = message.data.eventType;

    if (eventType === 'plan-updated') {
      handlePlanUpdated(message.data.plan!);
    } else if (eventType === 'chatmessage-updated') {
      handleChatMessageUpdated(message.data);
    } else if (eventType === 'revision-created') {
      handleRevisionCreated(message.data.revision!);
    } else if (eventType === 'render-updated') {
      handleRenderUpdated(message.data);
    } else if (eventType === 'render-stream') {
      handleRenderStreamEvent(message.data);
    }

    const isWorkspaceUpdatedEvent = message.data.workspace;
    if (isWorkspaceUpdatedEvent) {
      handleWorkspaceUpdated(message.data.workspace!);
    }

    const artifact = message.data.artifact;
    if (artifact && artifact.path && artifact.content) {
      handleArtifactReceivedRef.current?.(artifact);
    }
  }, [handlePlanUpdated, handleWorkspaceUpdated, handleChatMessageUpdated, handleRevisionCreated, handleRenderUpdated, handleRenderStreamEvent]);

  useEffect(() => {
    handlersRef.current.onMessage = handleCentrifugoMessage;
  }, [handleCentrifugoMessage]);

  useEffect(() => {
    if (!centrifugoToken || !session || !workspace?.id) {
      return;
    }

    const channel = `${workspace.id}#${session.user.id}`;

    const centrifuge = new Centrifuge(process.env.NEXT_PUBLIC_CENTRIFUGO_ADDRESS!, {
      timeout: 5000,
      token: centrifugoToken
    });

    centrifugeRef.current = centrifuge;

    centrifuge.on("connected", () => {
      console.log("Centrifugo connected");
      setIsReconnecting(false);
    });

    centrifuge.on("disconnected", async (ctx) => {
      console.log("Centrifugo disconnected", { ctx });
      setIsReconnecting(true);

      if (session) {
        try {
          const newToken = await getCentrifugoTokenAction(session);
          if (centrifugeRef.current && newToken) {
            centrifugeRef.current.setToken(newToken);
            setTimeout(() => {
              centrifugeRef.current?.connect();
            }, RECONNECT_DELAY_MS);
          }
        } catch (err) {
          console.error("Failed to refresh Centrifugo token:", err);
          // Optionally show a user-friendly error message
        }
      }
    });

    centrifuge.on("error", (ctx) => {
      console.error("Centrifugo error:", ctx);

      if (ctx.error.code === 109) { // Unauthorized error code
        setIsReconnecting(true);

        if (session) {
          getCentrifugoTokenAction(session)
            .then(newToken => {
              if (centrifugeRef.current && newToken) {
                centrifugeRef.current.setToken(newToken);
                setTimeout(() => {
                  centrifugeRef.current?.connect();
                }, RECONNECT_DELAY_MS);
              }
            })
            .catch(err => {
              console.error("Failed to refresh Centrifugo token after error:", err);
            });
        }
      }
    });

    const sub = centrifuge.newSubscription(channel, {
      data: {}
    });

    sub.on("publication", (message) => {
      handlersRef.current.onMessage?.(message);
    });

    sub.on("error", (ctx) => {
      console.error("Subscription error:", ctx);
    });

    sub.subscribe();

    try {
      centrifuge.connect();
    } catch (err) {
      console.error("Error connecting to Centrifugo:", err);
      setIsReconnecting(true);
    }

    return () => {
      try {
        if (centrifugeRef.current) {
          sub.unsubscribe();
          centrifugeRef.current.disconnect();
          centrifugeRef.current = null;
          setIsReconnecting(false);
        }
      } catch (err) {
        console.error("Error during Centrifugo cleanup:", err);
      }
    };
  }, [centrifugoToken, session, workspace?.id]);

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
                  handlePlanUpdated={handlePlanUpdated}
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
              />
            </div>
          );
        })()}
      </div>
      <CommandMenuWrapper />
    </EditorLayout>
  );
}
