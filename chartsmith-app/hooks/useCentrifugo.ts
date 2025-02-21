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
import { selectedFileAtom } from "@/atoms/editor";


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

  const handleArtifactReceived = useCallback((artifact: { path: string, content: string, pendingPatch?: string }) => {
    if (!setSelectedFile) return;

    setWorkspace(workspace => {
      if (!workspace) return workspace;

      const existingWorkspaceFile = workspace.files?.find(f => f.filePath === artifact.path);
      const chartWithFile = workspace.charts?.find(chart =>
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
          ...workspace,
          charts: workspace.charts.map((chart, index) =>
            index === 0 ? {
              ...chart,
              files: [...chart.files, newFile]
            } : chart
          )
        };
      }

      if (chartWithFile && artifact.pendingPatch) {
        setChartsBeforeApplyingPendingPatches(prev => [...prev, chartWithFile]);
      }

      const updatedFiles = workspace.files?.map(file =>
        file.filePath === artifact.path ? {
          ...file,
          content: artifact.content,
          pendingPatch: artifact.pendingPatch
        } : file
      ) || [];

      const updatedCharts = workspace.charts?.map(chart => ({
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
        ...workspace,
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

    setSelectedFile(file);
  }, [setSelectedFile]);

  const handleRenderStreamEvent = useCallback(async (data: CentrifugoMessageData) => {
    if (!session) return;
    if (data.eventType !== 'render-stream' || !data.renderChartId || !data.renderWorkspaceId) {
      return;
    }

    let renders = await setRenders(prev => {
      const newRenders = [...prev];

      // if the message has a renderWorkspaceId that we don't know, fetch and add it
      if (!newRenders.find(render => render.id === data.renderWorkspaceId)) {
        if (data.renderWorkspaceId) {
          getWorkspaceRenderAction(session, data.renderWorkspaceId).then(newWorkspaceRender => {
            setRenders(prev => [...prev, newWorkspaceRender]);
          });
        }
        return newRenders;
      }

      // Now update the renders with the new stream data
      return newRenders.map(render => {
        if (render.id !== data.renderWorkspaceId) return render;

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

  const handleRenderUpdated = useCallback((data: CentrifugoMessageData) => {
    console.log('Render updated event received:', {
      eventType: data.eventType,
      renderChartId: data.renderChartId,
      renderWorkspaceId: data.renderWorkspaceId,
      fullData: data
    });
  }, []);

  const handleConversionFileUpdatedMessage = useCallback((data: CentrifugoMessageData) => {
    if (!data.conversionId || !data.conversionFile) return;
    handleConversionFileUpdated(data.conversionId, data.conversionFile);
  }, [handleConversionFileUpdated]);

  const handleConversationUpdatedMessage = useCallback((data: CentrifugoMessageData) => {
    if (!data.conversion) return;
    handleConversionUpdated(data.conversion);
  }, []);

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
    } else if (eventType === 'render-updated') {
      handleRenderUpdated(message.data);
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
    if (artifact && artifact.path && artifact.content) {
      handleArtifactReceived(artifact);
    }
  }, [
    handlePlanUpdated,
    handleChatMessageUpdated,
    handleRevisionCreated,
    handleRenderStreamEvent,
    handleWorkspaceUpdated,
    handleArtifactReceived,
    handleRenderUpdated,
    handleConversionFileUpdatedMessage,
    handleConversationUpdatedMessage
  ]);

  useEffect(() => {
    if (!session?.user?.id || !workspace?.id) return;

    const channel = `${workspace.id}#${session.user.id}`;

    const setupCentrifuge = async () => {
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

      centrifuge.on("connected", () => {
        console.log(`Centrifugo connected`);
        setIsReconnecting(false);
      });

      centrifuge.on("disconnected", async (ctx) => {
        console.log(`Centrifugo disconnected`, { ctx });
        setIsReconnecting(true);

        if (session) {
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
      });

      centrifuge.on("error", (ctx) => {
        console.log(`Centrifugo error`, { ctx });

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
                console.log('Failed to refresh Centrifugo token after error', { err });
              });
          }
        }
      });

      const sub = centrifuge.newSubscription(channel, {
        data: {}
      });

      sub.on("publication", (msg) => {
        handleCentrifugoMessage(msg);
      });

      sub.on("error", (ctx) => {
        console.log(`Subscription error`, { ctx });
      });

      sub.on("subscribed", () => {
        console.log('Successfully subscribed to:', channel);
      });

      // Explicitly subscribe to the channel
      sub.subscribe();

      // Explicitly connect
      try {
        centrifuge.connect();
      } catch (err) {
        console.error("Error connecting to Centrifugo:", err);
        setIsReconnecting(true);
      }

      // Return cleanup function
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
    };

    setupCentrifuge();
  }, [session?.user?.id, workspace?.id, handleCentrifugoMessage]);

  return {
    handleCentrifugoMessage,
    isReconnecting
  };
}
