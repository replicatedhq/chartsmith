"use client"

import { useCallback, useEffect, useRef, useState } from "react";
import { Centrifuge } from "centrifuge";
import { Session } from "@/lib/types/session";
import { getCentrifugoTokenAction } from "@/lib/centrifugo/actions/get-centrifugo-token-action";
import { logger } from "@/lib/utils/logger";
import { Message, CentrifugoMessageData } from "@/components/editor/types";
import { Plan, Workspace, WorkspaceFile } from "@/lib/types/workspace";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { getWorkspaceRenderAction } from "@/lib/workspace/actions/get-workspace-render";

const RECONNECT_DELAY_MS = 1000;

interface UseCentrifugoProps {
  session: Session;
  workspace?: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setWorkspaceRenders: React.Dispatch<React.SetStateAction<any[]>>;
  handleFileSelect?: (file: WorkspaceFile) => void;
}

export function useCentrifugo({
  session,
  workspace,
  setWorkspace,
  setMessages,
  setWorkspaceRenders,
  handleFileSelect
}: UseCentrifugoProps) {
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handlePlanUpdated = useCallback((plan: Plan) => {
    setWorkspace(currentWorkspace => {
      if (plan.status === 'pending') {
        const updatedCurrentPlans = currentWorkspace.currentPlans.map(existingPlan => {
          if (existingPlan.id === plan.id) {
            return plan;
          }
          return { ...existingPlan, status: 'ignored' };
        });

        if (!updatedCurrentPlans.some(plan => plan.id === plan.id)) {
          updatedCurrentPlans.unshift(plan);
        }

        return {
          ...currentWorkspace,
          currentPlans: updatedCurrentPlans,
          previousPlans: currentWorkspace.previousPlans.map(p => ({ ...p, status: 'ignored' }))
        };
      }

      const existingPlanIndex = currentWorkspace.currentPlans.findIndex(p => p.id === plan.id);
      const updatedCurrentPlans = [...currentWorkspace.currentPlans];

      if (existingPlanIndex !== -1) {
        updatedCurrentPlans[existingPlanIndex] = plan;
      } else {
        updatedCurrentPlans.unshift(plan);
      }

      return {
        ...currentWorkspace,
        currentPlans: updatedCurrentPlans,
        previousPlans: currentWorkspace.previousPlans
      };
    });

    if (session && (plan.status === 'review' || plan.status === 'pending')) {
      getWorkspaceMessagesAction(session, workspace?.id).then(updatedMessages => {
        setMessages(updatedMessages);
      });
    }
  }, [session, workspace?.id, setMessages, setWorkspace]);

  const handleRevisionCreated = useCallback(async (revision: any) => {
    if (!session || !revision.workspaceId) return;

    const freshWorkspace = await getWorkspaceAction(session, revision.workspaceId);
    if (freshWorkspace) {
      setWorkspace(freshWorkspace);

      const updatedMessages = await getWorkspaceMessagesAction(session, revision.workspaceId);
      setMessages(updatedMessages);
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
        isComplete: chatMessage.isComplete,
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
    if (!handleFileSelect) return;

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
  }, [handleFileSelect, setWorkspace]);

  const handleRenderStreamEvent = useCallback(async (data: CentrifugoMessageData) => {
    if (!session) return;
    if (data.eventType !== 'render-stream' || !data.renderChartId || !data.renderWorkspaceId) {
      return;
    }

    let renders = await setWorkspaceRenders(prev => {
      const newRenders = [...prev];

      // if the message has a renderWorkspaceId that we don't know, fetch and add it
      if (!newRenders.find(render => render.id === data.renderWorkspaceId)) {
        getWorkspaceRenderAction(session, data.renderWorkspaceId).then(newWorkspaceRender => {
          setWorkspaceRenders(prev => [...prev, newWorkspaceRender]);
        });
        return newRenders;
      }

      // Now update the renders with the new stream data
      return newRenders.map(render => {
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
      });
    });
  }, [session, setWorkspaceRenders]);

  const handleCentrifugoMessage = useCallback((message: { data: CentrifugoMessageData }) => {
    const eventType = message.data.eventType;

    if (eventType === 'plan-updated') {
      handlePlanUpdated(message.data.plan!);
    } else if (eventType === 'chatmessage-updated') {
      handleChatMessageUpdated(message.data);
    } else if (eventType === 'revision-created') {
      handleRevisionCreated(message.data.revision!);
    } else if (eventType === 'render-stream') {
      handleRenderStreamEvent(message.data);
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
    handleArtifactReceived
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
        token
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
            console.log(`Failed to refresh Centrifugo token`, { err });
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
                console.log(`Failed to refresh Centrifugo token after error`, { err });
              });
          }
        }
      });

      const sub = centrifuge.newSubscription(channel, {
        data: {}
      });

      sub.on("publication", handleCentrifugoMessage);

      sub.on("error", (ctx) => {
        console.log(`Subscription error`, { ctx });
      });

      sub.subscribe();

      try {
        centrifuge.connect();
      } catch (err) {
        logger.error("Error connecting to Centrifugo:", err);
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
          logger.error("Error during Centrifugo cleanup:", err);
        }
      };
    };

    setupCentrifuge();
  }, [session?.user?.id, workspace?.id, handleCentrifugoMessage]);

  return { isReconnecting };
}
