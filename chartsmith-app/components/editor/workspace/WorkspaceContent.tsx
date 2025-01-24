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
import { Message, CentrifugoMessageData, RawPlan, RawWorkspace } from "@/components/editor/types";

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
import { PlanOnlyLayout } from "../layout/PlanOnlyLayout";
import { PlanContent } from "./PlanContent";

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

  const handlePlanUpdated = (plan: RawPlan) => {
    console.log(`received publication with plan status: ${plan.status}`);
    const p: Plan = {
      id: plan.id,
      description: plan.description,
      status: plan.status,
      workspaceId: plan.workspaceId,
      chatMessageIds: plan.chatMessageIds,
      createdAt: new Date(plan.createdAt),
    }

    setWorkspace(currentWorkspace => {
      // If this is a new pending plan, mark all other plans as ignored
      if (p.status === 'pending') {
        const updatedCurrentPlans = currentWorkspace.currentPlans.map(existingPlan =>
          existingPlan.id === p.id ? p : { ...existingPlan, status: 'ignored' }
        );
        const updatedPreviousPlans = currentWorkspace.previousPlans.map(existingPlan =>
          ({ ...existingPlan, status: 'ignored' })
        );

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

      // For non-pending plans, just update the existing plan
      const updatedCurrentPlans = currentWorkspace.currentPlans.map(existingPlan =>
        existingPlan.id === p.id ? p : existingPlan
      );
      const updatedPreviousPlans = currentWorkspace.previousPlans.map(existingPlan =>
        existingPlan.id === p.id ? p : existingPlan
      );

      return {
        ...currentWorkspace,
        currentPlans: updatedCurrentPlans,
        previousPlans: updatedPreviousPlans
      };
    });

    // Refresh messages when we get a new plan or when plan status changes to 'review'
    if (session && (p.status === 'review' || p.status === 'pending')) {
      getWorkspaceMessagesAction(session, workspaceId).then(updatedMessages => {
        setMessages(updatedMessages);
      });
    }
  }

  const handleWorkspaceUpdated = (workspace: RawWorkspace) => {
    console.log(`workspace updated`, workspace);
  }

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
      const isPlanUpdatedEvent = message.data.plan;
      if (isPlanUpdatedEvent) {
        handlePlanUpdated(message.data.plan!);
      }

      const isWorkspaceUpdatedEvent = message.data.workspace;
      if (isWorkspaceUpdatedEvent) {
        handleWorkspaceUpdated(message.data.workspace!);
      }
    });
    sub.on("subscribed", () => {});
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

  // Show chat-only view when there's no revision yet
  if (!showEditor) {
    return (
      <PlanOnlyLayout>
        <PlanContent
          session={session}
          workspace={workspace!}
          messages={messages}
        />
      </PlanOnlyLayout>
    );
  }

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
