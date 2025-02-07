"use server"

import React from 'react';
import { TopNav } from '@/components/TopNav';
import { ValuesContent } from '@/components/values/ValuesContent';
import { getWorkspaceAction } from '@/lib/workspace/actions/get-workspace';
import { listScenariosAction } from '@/lib/workspace/actions/list-scenarios';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth/actions/validate-session';

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ValuesPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return null;
  }
  const session = await validateSession(sessionToken);
  if (!session) {
    return null;
  }

  // Load workspace and scenarios
  const workspace = await getWorkspaceAction(session, id);
  if (!workspace) {
    return null;
  }

  // Load scenarios for each chart
  const scenariosMap = new Map();
  for (const chart of workspace.charts) {
    const scenarios = await listScenariosAction(session, id, chart.id);
    scenariosMap.set(chart.id, scenarios);
  }

  return (
    <div className="h-screen flex flex-col">
      <TopNav />
      <ValuesContent
        workspace={workspace}
        initialScenariosByChart={scenariosMap}
      />
    </div>
  );
}
