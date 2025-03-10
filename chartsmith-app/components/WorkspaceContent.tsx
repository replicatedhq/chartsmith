"use client";

import React, { useEffect } from "react";
import { useAtom } from 'jotai'

// hooks
import { useSession } from "@/app/hooks/useSession";
import { useCentrifugo } from "@/hooks/useCentrifugo";

// contexts
import { useCommandMenu } from '@/contexts/CommandMenuContext';

// components
import { PlanContent } from "@/components/PlanContent";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { WorkspaceContainer } from "@/components/WorkspaceContainer";
import { CommandMenuWrapper } from "@/components/CommandMenuWrapper";
import { ChatContainer } from "@/components/ChatContainer";

// server actions and types
import { Conversion, Plan, RenderedWorkspace, Workspace } from "@/lib/types/workspace";

// atoms
import { chartsBeforeApplyingPendingPatchesAtom, editorViewAtom, looseFilesBeforeApplyingPendingPatchesAtom, selectedFileAtom, workspaceAtom } from "@/atoms/workspace";
import { editorContentAtom } from "@/atoms/workspace";
import { messagesAtom, plansAtom, rendersAtom, conversionsAtom } from "@/atoms/workspace";
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
  const [, setChartsBeforeApplyingPendingPatches] = useAtom(chartsBeforeApplyingPendingPatchesAtom);
  const [, setLooseFilesBeforeApplyingPendingPatches] = useAtom(looseFilesBeforeApplyingPendingPatchesAtom);
  const [, setEditorView] = useAtom(editorViewAtom);
  const [, setSelectedFile] = useAtom(selectedFileAtom);

  // Hydrate atoms on mount and when initial values change
  useEffect(() => {
    setWorkspace(initialWorkspace);

    // hydrate the before applying pending patches based on the current state
    setChartsBeforeApplyingPendingPatches(initialWorkspace.charts);
    setLooseFilesBeforeApplyingPendingPatches(initialWorkspace.files);

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
    setMessages,
    setPlans,
    setRenders,
    setConversions,
    setChartsBeforeApplyingPendingPatches,
    setLooseFilesBeforeApplyingPendingPatches,
    setEditorView,
    setSelectedFile
  ]);

  const { session } = useSession();

  const { openCommandMenu } = useCommandMenu();

  const [editorContent, setEditorContent] = useAtom(editorContentAtom)

  useCentrifugo({
    session,
  });

  const showEditor = workspace?.currentRevisionNumber && workspace?.currentRevisionNumber > 0 || workspace?.incompleteRevisionNumber;

  if (!session || !workspace) return null;

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
                  session={session}
                />
              ) : (
                <ChatContainer
                  session={session}
                />
              )}
            </div>
          </div>
        </div>
        {showEditor && (() => {
          return (
            <div className="flex-1 h-full translate-x-[480px]">
              <WorkspaceContainer
                session={session}
                editorContent={editorContent}
                onEditorChange={(value) => {
                  setEditorContent(value ?? "");
                }}
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
