"use client"

import { useSession } from '@/app/hooks/useSession';
import { SideNav } from '@/components/SideNav';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { WorkspaceUIProvider, useWorkspaceUI } from '@/contexts/WorkspaceUIContext';
import { Workspace } from '@/lib/types/workspace';
import { getWorkspaceAction } from '@/lib/workspace/actions/get-workspace';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

type WorkspaceChildProps = {
  workspace: Workspace | undefined;
};

interface LayoutProps {
  children: React.ReactElement<WorkspaceChildProps>;
}

function WorkspaceLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const params = useParams();
  const { session } = useSession();
  const { workspace, setWorkspace } = useWorkspace();
  const { isChatVisible, setIsChatVisible, isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();

  useEffect(() => {
    if (!session || !params.id) return;
    getWorkspaceAction(session, params.id as string).then(workspace => {
      setWorkspace(workspace);
    });
  }, [session, params.id, setWorkspace]);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-dark' : 'bg-white'} flex w-full`}>
      {params.id && workspace && workspace.isInitialized && (
        <SideNav
          workspaceID={params.id as string}
          isChatVisible={isChatVisible}
          onToggleChat={() => setIsChatVisible(!isChatVisible)}
          isFileTreeVisible={isFileTreeVisible}
          onToggleFileTree={() => setIsFileTreeVisible(!isFileTreeVisible)}
        />
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceUIProvider>
      <WorkspaceProvider>
        <WorkspaceLayoutContent>
          {children}
        </WorkspaceLayoutContent>
      </WorkspaceProvider>
    </WorkspaceUIProvider>
  );
}
