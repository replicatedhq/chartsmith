"use client"

import { useCallback, useEffect, useRef, useState } from "react";
import { Centrifuge } from "centrifuge";
import { useAtom } from "jotai";

// types
import { Session } from "@/lib/types/session";
import { Message, CentrifugoMessageData } from "@/components/types";

// actions
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { getWorkspaceRenderAction } from "@/lib/workspace/actions/get-workspace-render";


// atoms
import {
  messagesAtom,
  rendersAtom,
  workspaceAtom,
  handlePlanUpdatedAtom,
  looseFilesBeforeApplyingPendingPatchesAtom,
  chartsBeforeApplyingPendingPatchesAtom,
  handleConversionUpdatedAtom,
  handleConversionFileUpdatedAtom
 } from "@/atoms/workspace";
import { selectedFileAtom } from "@/atoms/workspace";


// types
import { RenderedChart } from "@/lib/types/workspace";

const RECONNECT_DELAY_MS = 1000;

interface UseCentrifugoProps {
  session: Session | undefined;
}

export function useCentrifugo({
  session,
}: UseCentrifugoProps) {
  const centrifugeRef = useRef<Centrifuge | null>(null);

  const [workspace, setWorkspace] = useAtom(workspaceAtom)
  const [, setRenders] = useAtom(rendersAtom)
  const [, setMessages] = useAtom(messagesAtom)
  const [, setSelectedFile] = useAtom(selectedFileAtom)
  const [, setChartsBeforeApplyingPendingPatches] = useAtom(chartsBeforeApplyingPendingPatchesAtom)
  const [, setLooseFilesBeforeApplyingPendingPatches] = useAtom(looseFilesBeforeApplyingPendingPatchesAtom)
  const [, handleConversionUpdated] = useAtom(handleConversionUpdatedAtom)
  const [, handleConversionFileUpdated] = useAtom(handleConversionFileUpdatedAtom)
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [, handlePlanUpdated] = useAtom(handlePlanUpdatedAtom);

  const handleRevisionCreated = useCallback(async (revision: any) => {
    if (!session || !revision.workspaceId) return;

    const freshWorkspace = await getWorkspaceAction(session, revision.workspaceId);
    if (freshWorkspace) {
      setWorkspace(freshWorkspace);

      const updatedMessages = await getWorkspaceMessagesAction(session, revision.workspaceId);
      setMessages(updatedMessages);

      setChartsBeforeApplyingPendingPatches([]);
      setLooseFilesBeforeApplyingPendingPatches([]);
    }
  }, [session, setMessages, setWorkspace]);

  const handleChatMessageUpdated = useCallback((data: CentrifugoMessageData) => {
    if (!data.chatMessage) return;

    const chatMessage = data.chatMessage;
    console.log("Received chat message update:", chatMessage);
    setMessages(prev => {
      const newMessages = [...prev];
      const index = newMessages.findIndex(m => m.id === chatMessage.id);

      const message: Message = {
        id: chatMessage.id,
        prompt: chatMessage.prompt,
        response: chatMessage.responseRenderId ? "doing the render now..." : chatMessage.response,
        isComplete: chatMessage.isComplete || false,  // Provide default value
        isApplied: chatMessage.isApplied,
        isApplying: chatMessage.isApplying,
        isIgnored: chatMessage.isIgnored,
        isCanceled: chatMessage.isCanceled,
        createdAt: new Date(chatMessage.createdAt),
        workspaceId: chatMessage.workspaceId,
        userId: chatMessage.userId,
        isIntentComplete: chatMessage.isIntentComplete,
        followupActions: chatMessage.followupActions,
        responseRenderId: chatMessage.responseRenderId,
        responsePlanId: chatMessage.responsePlanId,
        responseRollbackToRevisionNumber: chatMessage.responseRollbackToRevisionNumber,
        revisionNumber: chatMessage.revisionNumber,
      };

      if (index >= 0) {
        newMessages[index] = message;
      } else {
        newMessages.push(message);
      }
      return newMessages;
    });
  }, [setMessages]);

  const handleWorkspaceUpdated = useCallback((workspace: any) => {
    // Implementation can be added based on requirements
  }, []);

  // Helper function to determine if a patch is for a new file
  const isNewFilePatch = (patch?: string) => {
    if (!patch) return false;
    return patch.includes('@@ -0,0 +1,');
  };

  // Helper function to get the appropriate content for a file
  const getFileContent = (existingContent: string | undefined, artifact: { path: string, content: string, pendingPatch?: string }) => {
    // If we have a pending patch for a new file, content should be empty string
    if (isNewFilePatch(artifact.pendingPatch)) {
      return "";
    }

    // For existing files with patches, preserve their content
    if (existingContent) {
      return existingContent;
    }

    // For existing files that don't have content yet, use artifact.content if available
    return artifact.content || "";
  };

  const handleArtifactReceived = useCallback((artifact: { path: string, content: string, pendingPatch?: string }) => {
    if (!setSelectedFile) return;

    // Generate a consistent file ID once to use in both places
    const fileId = `file-${Date.now()}`;

    setWorkspace(workspace => {
      if (!workspace) return workspace;

      // First check for the file in the top-level files array
      const existingWorkspaceFile = workspace.files?.find(f => f.filePath === artifact.path);

      // Then check if the file exists in any chart
      let chartWithFile = null;
      let fileInChart = null;

      if (workspace.charts) {
        for (const chart of workspace.charts) {
          const foundFile = chart.files.find(f => f.filePath === artifact.path);
          if (foundFile) {
            chartWithFile = chart;
            fileInChart = foundFile;
            break;
          }
        }
      }

      // Check if it's a new file patch
      const isNewFile = !existingWorkspaceFile && !fileInChart;
      const isNewFileFromPatch = isNewFilePatch(artifact.pendingPatch);

      // Fix for new files - ensure proper initialization for diff to work
      // If the file doesn't exist anywhere, create a new file and add it to both places
      if (isNewFile) {
        // For new files that have a pending patch but no content, initialize content to empty string
        // This matches backend behavior where new files have content="" and pendingPatch with the full content
        const newFile = {
          id: fileId,
          filePath: artifact.path,
          // For new files, use empty content and pendingPatch with the full content
          content: "",
          // Make sure pendingPatch always exists for new files
          pendingPatch: artifact.pendingPatch || artifact.content || ""
        };

        // Add to both the first chart AND to the top-level files array
        // Make sure we have at least one chart
        if (!workspace.charts || workspace.charts.length === 0) {
          return workspace;
        }

        return {
          ...workspace,
          // Add the new file to the workspace files array
          files: [...(workspace.files || []), newFile],
          charts: workspace.charts.map((chart, index) =>
            index === 0 ? {
              ...chart,
              files: [...chart.files, newFile]
            } : chart
          )
        };
      }

      // If the file exists and has a pending patch, track the pre-patch state
      if (chartWithFile && artifact.pendingPatch) {
        setChartsBeforeApplyingPendingPatches(prev => [...prev, chartWithFile]);
      }

      // Determine content for existing files based on the patch type
      const existingContent = existingWorkspaceFile?.content || fileInChart?.content;

      // Update files in the top-level files array
      const updatedFiles = workspace.files?.map(file =>
        file.filePath === artifact.path ? {
          ...file,
          content: getFileContent(file.content, artifact),
          pendingPatch: artifact.pendingPatch
        } : file
      ) || [];

      // Update files in all charts
      const updatedCharts = workspace.charts?.map(chart => ({
        ...chart,
        files: chart.files.map(file =>
          file.filePath === artifact.path ? {
            ...file,
            content: getFileContent(file.content, artifact),
            pendingPatch: artifact.pendingPatch
          } : file
        )
      })) || [];

      return {
        ...workspace,
        files: updatedFiles,
        charts: updatedCharts
      };
    });

    // Create a representation of the file for the editor with appropriate content
    const file = {
      id: fileId, // Use the same ID created above
      filePath: artifact.path,
      // For new files, set empty content
      content: isNewFilePatch(artifact.pendingPatch) ? "" : (artifact.content || ""),
      // Make sure pendingPatch is always defined, even for empty patches
      pendingPatch: artifact.pendingPatch || artifact.content || ""
    };

    setSelectedFile(file);
  }, [setSelectedFile, setChartsBeforeApplyingPendingPatches]);

  const handleRenderStreamEvent = useCallback(async (data: CentrifugoMessageData) => {
    if (!session) return;
    if (data.eventType !== 'render-stream' || !data.renderChartId || !data.renderId) {
      return;
    }

    console.log(data);
    let renders = await setRenders(prev => {
      const newRenders = [...prev];

      // if the message has a renderWorkspaceId that we don't know, fetch and add it
      if (!newRenders.find(render => render.id === data.renderId)) {
        if (data.renderId) {
          getWorkspaceRenderAction(session, data.renderId).then(newWorkspaceRender => {
            setRenders(prev => [...prev, newWorkspaceRender]);
          });
        }
        return newRenders;
      }

      // Now update the renders with the new stream data
      return newRenders.map(render => {
        if (render.id !== data.renderId) return render;

        return {
          ...render,
          charts: render.charts.map((chart: RenderedChart) => {
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
      });
    });
  }, [session, setRenders]);

  const handleRenderFileEvent = useCallback((data: CentrifugoMessageData) => {
    if (!data.renderId || !data.renderChartId || !data.renderedFile) return;


    const render = data.renderId;
    const renderChartId = data.renderChartId;
    const renderedFile = data.renderedFile;


    setRenders(prev => {
      const newRenders = [...prev];
      const index = newRenders.findIndex(r => r.id === render);
      
      // If the render exists, update it with the new file
      if (index !== -1) {
        // Create a copy of the render
        const updatedRender = { ...newRenders[index] };
        
        // Find the chart to update
        const chartIndex = updatedRender.charts.findIndex(c => c.id === renderChartId);
        
        if (chartIndex !== -1) {
          // Create a copy of the chart
          const updatedChart = { ...updatedRender.charts[chartIndex] };
          
          // Add the new file to the chart's rendered files
          updatedChart.renderedFiles = [
            ...(updatedChart.renderedFiles || []),
            renderedFile
          ];
          
          // Update the chart in the render
          updatedRender.charts[chartIndex] = updatedChart;
          
          // Update the render in the list
          newRenders[index] = updatedRender;
          
        }
      }
      
      return newRenders;
    });

  }, [setRenders]);

  const handleConversionFileUpdatedMessage = useCallback((data: CentrifugoMessageData) => {
    if (!data.conversionId || !data.conversionFile) return;
    handleConversionFileUpdated(data.conversionId, data.conversionFile);
  }, [handleConversionFileUpdated]);

  const handleConversationUpdatedMessage = useCallback((data: CentrifugoMessageData) => {
    if (!data.conversion) return;
    handleConversionUpdated(data.conversion);
  }, []);

  const handleExecuteAction = async (message: any) => {
    // ... existing message handling ...

    // Handle file creation
    if (message.type === 'execute_action' && message.action === 'create_file') {
      const { filePath, content } = message.data;
      handleArtifactReceived({ path: filePath, content });
    }

    // ... rest of message handling ...
  };

  const handleCentrifugoMessage = useCallback((message: { data: CentrifugoMessageData }) => {
    const eventType = message.data.eventType;
    if (eventType === 'plan-updated') {
      const plan = message.data.plan!;
      handlePlanUpdated({
        ...plan,
        createdAt: new Date(plan.createdAt),
        isComplete: plan.isComplete || false
      });
    } else if (eventType === 'chatmessage-updated') {
      handleChatMessageUpdated(message.data);
    } else if (eventType === 'revision-created') {
      handleRevisionCreated(message.data.revision!);
    } else if (eventType === 'render-stream') {
      handleRenderStreamEvent(message.data);
    } else if (eventType === 'render-file') {
      handleRenderFileEvent(message.data);
    } else if (eventType === 'conversion-file') {
      handleConversionFileUpdatedMessage(message.data);
    } else if (eventType === 'conversion-status') {
      handleConversationUpdatedMessage(message.data);
    }

    const isWorkspaceUpdatedEvent = message.data.workspace;
    if (isWorkspaceUpdatedEvent) {
      handleWorkspaceUpdated(message.data.workspace!);
    }

    const artifact = message.data.artifact;
    if (artifact) {
      // Check if path and content exist, even if content is empty string
      if (artifact.path) {
        handleArtifactReceived(artifact);
      } else {
        console.error("Artifact missing required path:", artifact);
      }
    }

    handleExecuteAction(message.data);
  }, [
    handlePlanUpdated,
    handleChatMessageUpdated,
    handleRevisionCreated,
    handleRenderStreamEvent,
    handleWorkspaceUpdated,
    handleArtifactReceived,
    handleRenderFileEvent,
    handleConversionFileUpdatedMessage,
    handleConversationUpdatedMessage
  ]);

  useEffect(() => {
    if (!session?.user?.id || !workspace?.id) return;

    const channel = `${workspace.id}#${session.user.id}`;
    let cleanup: (() => void) | undefined;

    // Move setupCentrifuge outside of the effect to avoid recreating on each render
    const setupCentrifuge = async () => {
      // Prevent multiple connection attempts if already connecting
      if (centrifugeRef.current) {
        return;
      }

      const token = await getCentrifugoTokenAction(session);
      if (!token) {
        console.log(`Failed to get Centrifugo token`);
        return;
      }

      const centrifuge = new Centrifuge(process.env.NEXT_PUBLIC_CENTRIFUGO_ADDRESS!, {
        timeout: 5000,
        token,
        getToken: async () => {
          console.log(`Centrifugo refreshing token`);
          const token = await getCentrifugoTokenAction(session);
          return token;
        }
      });

      centrifugeRef.current = centrifuge;

      // Memoize event handlers to prevent recreating them
      const handleConnect = () => {
        console.log(`Centrifugo connected`);
        setIsReconnecting(false);
      };

      const handleDisconnect = async (ctx: any) => {
        console.log(`Centrifugo disconnected`, { ctx });
        setIsReconnecting(true);

        if (session && centrifugeRef.current) {
          try {
            console.log(`Attempting to refresh Centrifugo token`);
            const newToken = await getCentrifugoTokenAction(session);
            if (centrifugeRef.current && newToken) {
              centrifugeRef.current.setToken(newToken);
              setTimeout(() => {
                centrifugeRef.current?.connect();
              }, RECONNECT_DELAY_MS);
            }
          } catch (err) {
            console.log('Failed to refresh Centrifugo token after error', { err });
          }
        }
      };

      centrifuge.on("connected", handleConnect);
      centrifuge.on("disconnected", handleDisconnect);
      centrifuge.on("error", (ctx) => {
        console.log(`Centrifugo error`, { ctx });
        if (ctx.error.code === 109) {
          handleDisconnect(ctx);
        }
      });

      const sub = centrifuge.newSubscription(channel, {
        data: {}
      });

      sub.on("publication", handleCentrifugoMessage);
      sub.on("error", (ctx) => {
        console.log(`Subscription error`, { ctx });
      });
      sub.on("subscribed", () => {
        console.log('Successfully subscribed to:', channel);
      });

      sub.subscribe();

      try {
        centrifuge.connect();
      } catch (err) {
        console.error("Error connecting to Centrifugo:", err);
        setIsReconnecting(true);
      }

      cleanup = () => {
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
    };

    setupCentrifuge();
    return () => cleanup?.();
  }, [session?.user?.id, workspace?.id]); // Removed handleCentrifugoMessage from dependencies

  return {
    handleCentrifugoMessage,
    isReconnecting
  };
}
