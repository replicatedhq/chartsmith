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
  chartsBeforeApplyingContentPendingAtom,
  handleConversionUpdatedAtom,
  handleConversionFileUpdatedAtom,
  activeRenderIdsAtom
 } from "@/atoms/workspace";
import { selectedFileAtom } from "@/atoms/workspace";


// types
import { RenderedChart } from "@/lib/types/workspace";
import { replayEventsAction } from "@/lib/centrifugo/actions/reply-events-action";

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
  const [, setChartsBeforeApplyingContentPending] = useAtom(chartsBeforeApplyingContentPendingAtom)
  const [, handleConversionUpdated] = useAtom(handleConversionUpdatedAtom)
  const [, handleConversionFileUpdated] = useAtom(handleConversionFileUpdatedAtom)
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [, handlePlanUpdated] = useAtom(handlePlanUpdatedAtom);
  const [, setActiveRenderIds] = useAtom(activeRenderIdsAtom);

  const handleRevisionCreated = useCallback(async (revision: any) => {
    if (!session || !revision.workspaceId) return;

    const freshWorkspace = await getWorkspaceAction(session, revision.workspaceId);
    if (freshWorkspace) {
      setWorkspace(freshWorkspace);

      const updatedMessages = await getWorkspaceMessagesAction(session, revision.workspaceId);
      setMessages(updatedMessages);

      setChartsBeforeApplyingContentPending([]);
    }
  }, [session, setMessages, setWorkspace]);

  const handleChatMessageUpdated = useCallback((data: CentrifugoMessageData) => {
    if (!data.chatMessage) return;

    const chatMessage = data.chatMessage;

    // If this message starts a render operation, track the render ID
    if (chatMessage.responseRenderId) {
      setActiveRenderIds(prev => {
        // Only add if not already tracked
        if (!prev.includes(chatMessage.responseRenderId!)) {
          return [...prev, chatMessage.responseRenderId!];
        }
        return prev;
      });
    }

    // If the message is complete and had a render ID, we can remove the render from active
    if (chatMessage.isComplete && chatMessage.responseRenderId) {
      setActiveRenderIds(prev => prev.filter(id => id !== chatMessage.responseRenderId));
    }

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
  }, [setMessages, setActiveRenderIds]);

  const handleWorkspaceUpdated = useCallback((workspace: any) => {
    // Implementation can be added based on requirements
  }, []);

  // Helper function to determine if a patch is for a new file
  const isNewFilePatch = (patches?: string[]) => {
    if (!patches || patches.length === 0) return false;
    return patches[0].includes('@@ -0,0 +1,');
  };

  // Helper function to get the appropriate content for a file
  const getFileContent = (existingContent: string | undefined, artifact: { path: string, content: string, contentPending?: string }) => {
    // For existing files with patches, preserve their content
    if (existingContent) {
      return existingContent;
    }

    // For existing files that don't have content yet, use artifact.content if available
    return artifact.content || "";
  };

  const handleArtifactReceived = useCallback((artifact: { path: string, content: string, contentPending?: string }) => {
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

      // Fix for new files - ensure proper initialization for diff to work
      // If the file doesn't exist anywhere, create a new file and add it to both places
      if (isNewFile) {
        // For new files that have a pending patch but no content, initialize content to empty string
        const newFile = {
          id: fileId,
          filePath: artifact.path,
          // For new files, use empty content and contentPending with the full content
          content: "",
          contentPending: "",
          revisionNumber: 0, // Default revision number
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


      // Determine content for existing files based on the patch type
      const existingContent = existingWorkspaceFile?.content || fileInChart?.content;

      // Update files in the top-level files array
      const updatedFiles = workspace.files?.map(file =>
        file.filePath === artifact.path ? {
          ...file,
          content: getFileContent(file.content, artifact),
          contentPending: "",
          // Keep the existing revisionNumber
          revisionNumber: file.revisionNumber
        } : file
      ) || [];

      // Update files in all charts
      const updatedCharts = workspace.charts?.map(chart => ({
        ...chart,
        files: chart.files.map(file =>
          file.filePath === artifact.path ? {
            ...file,
            content: getFileContent(file.content, artifact),
            // Keep the existing revisionNumber
            revisionNumber: file.revisionNumber
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
      content: artifact.content || "",
      contentPending: artifact.contentPending,
      revisionNumber: 0,
    };

    setSelectedFile(file);
  }, [setSelectedFile, setChartsBeforeApplyingContentPending]);

  const handleRenderStreamEvent = useCallback(async (data: CentrifugoMessageData) => {
    if (!session) return;
    if (data.eventType !== 'render-stream' || !data.renderChartId || !data.renderId) {
      return;
    }

    // If this is a completion event (has completedAt or similar marker)
    if (data.completedAt) {
      setActiveRenderIds(prev => prev.filter(id => id !== data.renderId));
    } else if (data.renderId) {
      // Add to active renders if not already there
      setActiveRenderIds(prev => {
        if (!prev.includes(data.renderId!)) {
          return [...prev, data.renderId!];
        }
        return prev;
      });
    }

    await setRenders(prev => {
      const newRenders = [...prev];

      // if the message has a renderWorkspaceId that we don't know, fetch and add it
      if (!newRenders.find(render => render.id === data.renderId)) {
        if (data.renderId) {
          getWorkspaceRenderAction(session, data.renderId).then(newWorkspaceRender => {
            // Check if render is complete and remove from active if it is
            if (newWorkspaceRender.completedAt) {
              setActiveRenderIds(prev => prev.filter(id => id !== data.renderId));
            }

            // Ensure dates are properly formatted
            const formattedRender = {
              ...newWorkspaceRender,
              // Ensure createdAt is a Date
              createdAt: new Date(newWorkspaceRender.createdAt),
              // Ensure completedAt is a Date or undefined
              completedAt: newWorkspaceRender.completedAt
                ? new Date(newWorkspaceRender.completedAt)
                : undefined,
              isAutorender: newWorkspaceRender.isAutorender,
              // Format dates for each chart
              charts: newWorkspaceRender.charts.map(chart => ({
                ...chart,
                createdAt: new Date(chart.createdAt),
                completedAt: chart.completedAt
                  ? new Date(chart.completedAt)
                  : undefined
              }))
            };

            setRenders(prev => {
              // Check if we already have a render for this revision to avoid duplicates
              const alreadyHasRenderForRevision = prev.some(r =>
                r.revisionNumber === formattedRender.revisionNumber && r.id !== formattedRender.id
              );

              if (alreadyHasRenderForRevision) {
                console.debug(`Skipping duplicate render for revision ${formattedRender.revisionNumber}`);
                return prev;
              }

              return [...prev, formattedRender];
            });
          });
        }
        return newRenders;
      }

      // Now update the renders with the new stream data
      return newRenders.map(render => {
        if (render.id !== data.renderId) return render;

        // Check if the render is now complete
        const isComplete = data.completedAt ? true : render.completedAt ? true : false;

        if (isComplete && !render.completedAt) {
          // Remove from active renders
          setActiveRenderIds(prev => prev.filter(id => id !== data.renderId));
        }

        // Make sure we convert string date to Date object if needed
        const completedAtDate = data.completedAt
          ? new Date(data.completedAt)
          : render.completedAt;

        return {
          ...render,
          completedAt: completedAtDate,
          charts: render.charts.map((chart: RenderedChart) => {
            if (chart.id !== data.renderChartId) return chart;

            // Also convert chart completion date to Date object if needed
            const chartCompletedAt = data.completedAt
              ? new Date(data.completedAt)
              : chart.completedAt;

            return {
              ...chart,
              helmTemplateCommand: data.helmTemplateCommand,
              helmTemplateStderr: data.helmTemplateStderr,
              helmTemplateStdout: data.helmTemplateStdout,
              depUpdateCommand: data.depUpdateCommand,
              depUpdateStderr: data.depUpdateStderr,
              depUpdateStdout: data.depUpdateStdout,
              completedAt: chartCompletedAt,
            };
          })
        };
      });
    });
  }, [session, setRenders, setActiveRenderIds]);

  const handleRenderFileEvent = useCallback((data: CentrifugoMessageData) => {
    if (!data.renderId || !data.renderChartId || !data.renderedFile) return;

    const render = data.renderId;
    const renderChartId = data.renderChartId;
    const renderedFile = data.renderedFile;

    console.log('handleRenderFileEvent', data);

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

          // Initialize renderedFiles array if it doesn't exist
          const currentRenderedFiles = updatedChart.renderedFiles || [];

          // Check if this file already exists in the rendered files (based on id)
          const existingFileIndex = currentRenderedFiles.findIndex(
            f => f.id === renderedFile.id
          );

          if (existingFileIndex !== -1) {
            // Update the existing file instead of adding a duplicate
            const updatedFiles = [...currentRenderedFiles];
            updatedFiles[existingFileIndex] = renderedFile;
            updatedChart.renderedFiles = updatedFiles;
          } else {
            // Add the new file only if it doesn't already exist
            updatedChart.renderedFiles = [...currentRenderedFiles, renderedFile];
          }

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

  // Clear active renders when component unmounts
  useEffect(() => {
    return () => {
      // Reset active renders on unmount
      setActiveRenderIds([]);
    };
  }, [setActiveRenderIds]);

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
      sub.on("subscribed", async () => {
        console.log('Successfully subscribed to:', channel);

        // call a server action to replay the events we maybe missed
        // when we first connected
        const replayedEvents = await replayEventsAction(session);
        for (const event of replayedEvents) {
          handleCentrifugoMessage({ data: event });
        }
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
