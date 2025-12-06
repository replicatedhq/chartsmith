"use client";

import React, { useEffect, useRef } from "react";
import { useAtom } from 'jotai'

// hooks
import { useSession } from "@/app/hooks/useSession";
import { useCentrifugo } from "@/hooks/useCentrifugo";
import { currentStreamingMessageIdAtom } from "@/hooks/useAISDKChatAdapter";

// contexts
import { useCommandMenu } from '@/contexts/CommandMenuContext';

// components
import { EditorLayout } from "@/components/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/WorkspaceContainer";
import { CommandMenuWrapper } from "@/components/CommandMenuWrapper";
import { ChatContainer } from "@/components/ChatContainer";

// server actions and types
import { Conversion, Plan, RenderedWorkspace, Workspace } from "@/lib/types/workspace";

// atoms
import { chartsBeforeApplyingContentPendingAtom, editorViewAtom, looseFilesBeforeApplyingContentPendingAtom, selectedFileAtom, workspaceAtom } from "@/atoms/workspace";
import { editorContentAtom } from "@/atoms/workspace";
import { messagesAtom, plansAtom, rendersAtom, conversionsAtom, allFilesWithContentPendingAtom, isRenderingAtom } from "@/atoms/workspace";
import { Message } from "./types";

interface WorkspaceContentProps {
  initialWorkspace: Workspace;
  initialMessages: Message[];
  initialPlans: Plan[];
  initialRenders: RenderedWorkspace[];
  initialConversions: Conversion[];
  onOpenCommandMenu?: () => void;
}

export function WorkspaceContent({
  initialWorkspace,
  initialMessages,
  initialPlans,
  initialRenders,
  initialConversions,
}: WorkspaceContentProps) {
  // Instead of useHydrateAtoms, use useAtom and useEffect
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [, setMessages] = useAtom(messagesAtom);
  const [, setPlans] = useAtom(plansAtom);
  const [, setRenders] = useAtom(rendersAtom);
  const [, setConversions] = useAtom(conversionsAtom);
  const [, setChartsBeforeApplyingContentPending] = useAtom(chartsBeforeApplyingContentPendingAtom);
  const [, setLooseFilesBeforeApplyingContentPending] = useAtom(looseFilesBeforeApplyingContentPendingAtom);
  const [, setEditorView] = useAtom(editorViewAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);


  // Hydrate atoms on mount and when initial values change
  useEffect(() => {
    setWorkspace(initialWorkspace);

    // hydrate the before applying pending patches based on the current state
    setChartsBeforeApplyingContentPending(initialWorkspace.charts);
    setLooseFilesBeforeApplyingContentPending(initialWorkspace.files);

    setMessages(initialMessages);
    setPlans(initialPlans);
    setRenders(initialRenders);

    setConversions(initialConversions);

    // Always reset to source view with no file selected when switching workspaces
    setEditorView("source");
    setSelectedFile(undefined);
  }, [
    initialWorkspace,
    initialMessages,
    initialPlans,
    initialRenders,
    initialConversions,
    setWorkspace,
    setChartsBeforeApplyingContentPending,
    setLooseFilesBeforeApplyingContentPending,
    setMessages,
    setPlans,
    setRenders,
    setConversions,
    setEditorView,
    setSelectedFile
  ]);

  // PR3.0: Page reload guard - warn before leaving with uncommitted changes or during streaming
  const [filesWithPending] = useAtom(allFilesWithContentPendingAtom);
  const [isRendering] = useAtom(isRenderingAtom);
  const [currentStreamingMessageId] = useAtom(currentStreamingMessageIdAtom);
  
  // Keep refs in sync for use in beforeunload handler
  const filesWithPendingRef = useRef(filesWithPending);
  const isRenderingRef = useRef(isRendering);
  const isStreamingRef = useRef(!!currentStreamingMessageId);
  
  useEffect(() => {
    filesWithPendingRef.current = filesWithPending;
  }, [filesWithPending]);
  
  useEffect(() => {
    isRenderingRef.current = isRendering;
  }, [isRendering]);
  
  useEffect(() => {
    isStreamingRef.current = !!currentStreamingMessageId;
  }, [currentStreamingMessageId]);
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasPending = filesWithPendingRef.current.length > 0;
      const isActiveRendering = isRenderingRef.current;
      const isStreaming = isStreamingRef.current;
      
      if (hasPending || isActiveRendering || isStreaming) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but we still need to set returnValue
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const { session } = useSession();

  const { openCommandMenu } = useCommandMenu();

  const [editorContent] = useAtom(editorContentAtom)

  useCentrifugo({
    session,
  });

  // PR2.0: For AI SDK mode, show editor at revision 0 since files are created directly
  // Check if AI SDK mode is enabled
  const USE_AI_SDK_CHAT = process.env.NEXT_PUBLIC_USE_AI_SDK_CHAT !== 'false';
  
  // Show editor when:
  // 1. currentRevisionNumber > 0 (has committed changes)
  // 2. incompleteRevisionNumber exists (plan being applied)
  // 3. AI SDK mode at revision 0 (files created directly)
  const showEditor = (workspace?.currentRevisionNumber && workspace?.currentRevisionNumber > 0) 
    || workspace?.incompleteRevisionNumber
    || (USE_AI_SDK_CHAT && workspace?.currentRevisionNumber === 0);

  if (!session || !workspace) return null;

  // PR2.0: Determine if we should show centered chat (legacy mode at revision 0) or sidebar chat
  const showCenteredChat = !USE_AI_SDK_CHAT && (
    (!workspace?.currentRevisionNumber && !workspace?.incompleteRevisionNumber) || 
    (workspace.currentRevisionNumber === 0 && !workspace.incompleteRevisionNumber)
  );

  return (
    <EditorLayout>
      <div className="flex w-full overflow-hidden relative">
        <div className={`chat-container-wrapper transition-all duration-300 ease-in-out absolute ${
            showCenteredChat ? 'inset-0 flex justify-center' : 'left-0 top-0 bottom-0'
          }`}>
          <div className={`${showCenteredChat ? 'w-full max-w-3xl px-4' : 'w-[480px] h-full flex flex-col'}`}>
            <div className="flex-1 overflow-y-auto">
              <ChatContainer
                session={session}
              />
            </div>
          </div>
        </div>
        {showEditor && (() => {
          return (
            <div className="flex-1 h-full translate-x-[480px]">
              <WorkspaceContainer
                session={session}
                editorContent={editorContent}
                onCommandK={openCommandMenu}
              />
            </div>
          );
        })()}
      </div>
      <CommandMenuWrapper />
    </EditorLayout>
  );
}
