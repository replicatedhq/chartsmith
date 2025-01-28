"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useEditorView } from "@/hooks/useEditorView";
import { EditorLayout } from "@/components/editor/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/editor/workspace/WorkspaceContainer";
import { ChatContainer } from "@/components/editor/chat/ChatContainer";
import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { Message, CentrifugoMessageData, RawPlan, RawWorkspace, RawChatMessage } from "@/components/editor/types";

import { Plan, Workspace, WorkspaceFile } from "@/lib/types/workspace";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "@/components/editor/chat/ChatMessage";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { sendChatMessageAction } from "@/lib/workspace/actions/send-chat-message";
import { Centrifuge } from "centrifuge";
import { PromptInput } from "@/components/PromptInput";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { logger } from "@/lib/utils/logger";
import { getPlanAction } from "@/lib/workspace/actions/get-plan";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { PlanOnlyLayout } from "../layout/PlanOnlyLayout";
import { PlanContent } from "./PlanContent";
import { createPlanAction } from "@/lib/workspace/actions/create-plan";
import { isNewPlanAction } from "@/lib/workspace/actions/is-new-plan";
import { createNonPlanMessageAction } from "@/lib/workspace/actions/create-nonplan-message-action";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  workspaceId: string;
}

export function WorkspaceContent({ initialWorkspace, workspaceId }: WorkspaceContentProps) {
  // All hooks at the top level
  const { session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const { isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | undefined>();
  const [editorContent, setEditorContent] = useState<string>("");
  const [showClarificationInput, setShowClarificationInput] = useState(false);
  const [centrifugoToken, setCentrifugoToken] = useState<string | null>(null);
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const hasConnectedRef = useRef(false);
  const { view, toggleView, updateFileSelection } = useEditorView(
    usePathname()?.endsWith('/rendered') ? 'rendered' : 'source'
  );

  // useCallback hooks
  const handleFileSelect = useCallback((file: WorkspaceFile) => {
    setSelectedFile(file);
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

  const followMode = true; // Always true for now

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
  }, [session, workspaceId]); // Include workspaceId since we need to reload messages when it changes

  const handlePlanUpdated = React.useCallback((plan: RawPlan | Plan) => {
    // If it's a RawPlan, normalize it
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
      // Find any optimistic plan for this workspace
      const optimisticPlan = currentWorkspace.currentPlans.find(existingPlan => {
        const isOptimistic = existingPlan.id.startsWith('temp-');
        const matchesWorkspace = existingPlan.workspaceId === p.workspaceId;
        return isOptimistic && matchesWorkspace;
      });


      // If this is a real plan (non-temp id) and we have an optimistic plan, replace or update it
      if (!p.id.startsWith('temp-') && optimisticPlan) {
        // Find if we already have this plan
        const existingPlan = currentWorkspace.currentPlans.find(plan => plan.id === p.id);

        if (existingPlan) {
          // Update existing plan with new content and remove optimistic
          const updatedCurrentPlans = currentWorkspace.currentPlans
            .filter(plan => plan.id !== optimisticPlan.id)
            .map(plan => plan.id === p.id ? {...p} : plan);
          return {
            ...currentWorkspace,
            currentPlans: updatedCurrentPlans,
            previousPlans: currentWorkspace.previousPlans
          };
        } else if (p.status === 'planning') {
          // During planning phase, update the optimistic plan's content
          const updatedCurrentPlans = currentWorkspace.currentPlans.map(plan =>
            plan.id === optimisticPlan.id ? {...plan, description: p.description} : plan
          );
          return {
            ...currentWorkspace,
            currentPlans: updatedCurrentPlans,
            previousPlans: currentWorkspace.previousPlans
          };
        } else {
          // For other states, replace optimistic with real plan
          const updatedCurrentPlans = currentWorkspace.currentPlans.map(plan =>
            plan.id === optimisticPlan.id ? p : plan
          );
          return {
            ...currentWorkspace,
            currentPlans: updatedCurrentPlans,
            previousPlans: currentWorkspace.previousPlans
          };
        }
      }

      // If this is a new pending plan, mark all other plans as ignored
      if (p.status === 'pending') {
        const updatedCurrentPlans = currentWorkspace.currentPlans.map(existingPlan => {
          if (existingPlan.id === p.id) {
            return p;
          }
          return { ...existingPlan, status: 'ignored' };
        });
        const updatedPreviousPlans = currentWorkspace.previousPlans.map(existingPlan => {
          return { ...existingPlan, status: 'ignored' };
        });

        // Add new plan to start if it doesn't exist
        if (!updatedCurrentPlans.some(plan => plan.id === p.id)) {
          updatedCurrentPlans.unshift(p);
        }

        return {
          ...currentWorkspace,
          currentPlans: updatedCurrentPlans,
          previousPlans: updatedPreviousPlans
        };
      }

      // For non-pending plans, just update the existing plan or add if it's new
      let found = false;
      const updatedCurrentPlans = currentWorkspace.currentPlans.map(existingPlan => {
        if (existingPlan.id === p.id) {
          found = true;
          return p;
        }
        return existingPlan;
      });

      // If this is a new plan and not replacing an optimistic one, add it
      if (!found && !optimisticPlan) {
        updatedCurrentPlans.unshift(p);
      }
      const updatedPreviousPlans = currentWorkspace.previousPlans.map(existingPlan =>
        existingPlan.id === p.id ? p : existingPlan
      );

      return {
        ...currentWorkspace,
        currentPlans: updatedCurrentPlans,
        previousPlans: updatedPreviousPlans
      };
    });

    // Refresh messages when we get a new plan or when plan status changes
    if (session && (p.status === 'review' || p.status === 'pending')) {
      getWorkspaceMessagesAction(session, workspaceId).then(updatedMessages => {
        // Replace optimistic messages with real ones
        setMessages(updatedMessages);
      });
    }
  }, [session, workspaceId, setMessages]);

  const handleChatMessageUpdated = (chatMessage: RawChatMessage) => {
    console.log(`chat message updated`, chatMessage);

    setMessages?.(prev => {
      return prev.map(msg => msg.id === chatMessage.id ? { ...msg, ...chatMessage } : msg);
    });
  }

  const handleWorkspaceUpdated = (workspace: RawWorkspace) => {
    console.log(`workspace updated`, workspace);
  }

  useEffect(() => {
    if (!centrifugoToken || !session || !workspace?.id) {
      return;
    }

    // Only create new connection if we don't have one
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

      // Set up subscription
      const channel = `${workspace.id}#${session.user.id}`;
      const sub = cf.newSubscription(channel);

      sub.on("publication", (message: { data: CentrifugoMessageData }) => {
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

        const artifact = message.data.artifact;
        if (artifact && artifact.path && artifact.content) {
          console.log('Received artifact:', {
            path: artifact.path,
            contentLength: artifact.content.length
          });

          setWorkspace(currentWorkspace => {
            // Find if file exists in workspace or chart files
            const existingWorkspaceFile = currentWorkspace.files?.find(f => f.filePath === artifact.path);
            const chartWithFile = currentWorkspace.charts?.find(chart =>
              chart.files.some(f => f.filePath === artifact.path)
            );

            console.log('File location check:', {
              existingInWorkspace: !!existingWorkspaceFile,
              existingInChart: !!chartWithFile
            });

            // If file doesn't exist, add it to the chart
            if (!existingWorkspaceFile && !chartWithFile) {
              const newFile = {
                id: `file-${Date.now()}`,
                filePath: artifact.path,
                content: artifact.content
              };

              // Always add to the first chart
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

            // Update existing file
            const updatedFiles = currentWorkspace.files?.map(file =>
              file.filePath === artifact.path ? { ...file, content: artifact.content } : file
            ) || [];

            const updatedCharts = currentWorkspace.charts?.map(chart => ({
              ...chart,
              files: chart.files.map(file =>
                file.filePath === artifact.path ? { ...file, content: artifact.content } : file
              )
            })) || [];

            return {
              ...currentWorkspace,
              files: updatedFiles,
              charts: updatedCharts
            };
          });

          // Auto select the file
          const file = {
            id: `file-${Date.now()}`,
            filePath: artifact.path,
            content: artifact.content
          };
          console.log('Selecting file:', {
            path: file.filePath,
            id: file.id
          });
          handleFileSelect(file);
          setEditorContent(artifact.content);
          updateFileSelection({
            name: artifact.path.split('/').pop() || artifact.path,
            path: artifact.path,
            content: artifact.content,
            type: 'file' as const
          });
        }
      });
      sub.on("subscribed", () => {});
      sub.on("error", (ctx) => {
        logger.error("Centrifugo subscription error", { ctx });
      });

      sub.subscribe();
      cf.connect();
    }

    return () => {
      // Only disconnect if we're unmounting or changing workspace
      if (centrifugeRef.current) {
        centrifugeRef.current.disconnect();
        centrifugeRef.current = null;
      }
    };
  }, [centrifugoToken, session?.user.id, workspace?.id, handlePlanUpdated, session, handleFileSelect, updateFileSelection, setWorkspace, setEditorContent]); // Include all dependencies

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

    const isNewPlan = await isNewPlanAction(session, workspace.id, message);

    if (isNewPlan) {
      await createNewPlan(message);
    } else {
      await createNonPlanMessage(message);
    }
  }

  const createNonPlanMessage = async (message: string) => {
    if (!session || !workspace) return;

    const tempId = `temp-${Date.now()}`;

    // Create optimistic message (without a plan)
    const optimisticMessage: Message = {
      id: `msg-${tempId}`,
      prompt: message,
      response: "...",
      role: 'user',
      createdAt: new Date(),
      workspaceId: workspace.id,
      userId: session.user.id,
    };

    // Optimistically update UI
    setMessages?.(prev => {
      return [...prev, optimisticMessage];
    });

    const chatMessage = await createNonPlanMessageAction(session, message, workspace.id, "");

    // replace the optimize message with tmpId with the chatMessage
    setMessages?.(prev => {
      return prev.map(msg => msg.id === optimisticMessage.id ? { ...msg, ...chatMessage } : msg);
    });
  }

  const createNewPlan = async (message: string) => {
    if (!session || !workspace) return;

    // The LLM needs to first pass this
    const tempId = `temp-${Date.now()}`;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `msg-${tempId}`,
      prompt: message,
      response: undefined,
      role: 'user',
      createdAt: new Date(),
      workspaceId: workspace.id,
      planId: tempId,
      userId: session.user.id,
      isOptimistic: true // Add flag to identify optimistic messages
    };

    // Create optimistic plan with planning status
    const optimisticPlan: Plan = {
      id: tempId,
      description: '', // Empty by default, will be filled by streaming updates
      status: 'planning',
      workspaceId: workspace.id,
      chatMessageIds: [optimisticMessage.id],
      createdAt: new Date(),
      actionFiles: [], // Initialize with empty array
      isComplete: false
    };

    // Optimistically update UI
    setMessages(prev => {
      return [...prev, optimisticMessage];
    });

    // Mark other plans as ignored when adding new plan
    setWorkspace(currentWorkspace => ({
      ...currentWorkspace,
      currentPlans: [
        optimisticPlan,
        ...currentWorkspace.currentPlans.map(existingPlan => ({
          ...existingPlan,
          status: 'ignored'
        }))
      ]
    }));

    // Make actual API call
    await createPlanAction(session, message, workspace.id);
  };

  const handleApplyChanges = async (message: Message) => {
    if (!session || !workspace) return;

    try {
      const updatedWorkspace = await createRevisionAction(session, message.planId || workspace.id);
      if (!updatedWorkspace) return;

      // Get a fresh workspace state after revision
      if (session) {
        const freshWorkspace = await getWorkspaceAction(session, workspace.id);
        if (freshWorkspace) {
          // Set workspace state and wait for it to complete
          await new Promise<void>(resolve => {
            setWorkspace(freshWorkspace);
            // Use a short timeout to ensure state is updated
            setTimeout(resolve, 0);
          });
        }
      }

      // Refresh messages after workspace state is updated
      const updatedMessages = await getWorkspaceMessagesAction(session, workspace.id);
      setMessages(updatedMessages);
    } catch (err) {
      console.error('Error applying changes:', err);
    }
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

  useEffect(() => {
    if (showEditor) {
      console.log('Setting file tree visible');
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

    // Clear selected file and editor content when switching to rendered view
    if (newView === "rendered") {
      setSelectedFile(undefined);
      setEditorContent("");
    }

    toggleView(newFiles);
  };



  // Show chat-only view when there's no revision yet
  if (!showEditor) {
    return (
      <PlanOnlyLayout>
        <PlanContent
          session={session}
          workspace={workspace!}
          messages={messages}
          handlePlanUpdated={handlePlanUpdated}
          setMessages={setMessages}
          setWorkspace={setWorkspace}
          onSendMessage={handleSendMessage}
        />
      </PlanOnlyLayout>
    );
  }

  return (
    <EditorLayout>
      <div className="flex w-full overflow-hidden relative">          <div className={`chat-container-wrapper transition-all duration-300 ease-in-out absolute ${
            (!workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber) || (workspace.currentRevisionNumber === 0 && !workspace.incompleteRevisionNumber) ? 'inset-0 flex justify-center' : 'left-0 top-0 bottom-0'
          }`}>
            <div className={`${(!workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber) || (workspace.currentRevisionNumber === 0 && !workspace.incompleteRevisionNumber) ? 'w-full max-w-3xl px-4' : 'w-[480px]'}`}>
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
              view={view}
              onViewChange={handleViewChange}
              files={allFiles}
              charts={workspace.charts || []}
              renderedCharts={workspace.renderedCharts || []}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onFileDelete={handleFileDelete}
              editorContent={editorContent}
              onEditorChange={(value) => setEditorContent(value ?? "")}
              isFileTreeVisible={isFileTreeVisible}
            />
            </div>
          );
        })()}
      </div>
    </EditorLayout>
  );
}
