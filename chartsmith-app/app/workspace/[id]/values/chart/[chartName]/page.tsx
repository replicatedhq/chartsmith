"use server"

import { TopNav } from '@/components/TopNav';
import { ScenarioForm } from '@/components/values/ScenarioForm';
import { validateSession } from '@/lib/auth/actions/validate-session';
import { getWorkspaceAction } from '@/lib/workspace/actions/get-workspace';
import { cookies } from 'next/headers';
import { CommandMenuWrapper } from '@/components/CommandMenuWrapper';

interface CreateScenarioPageProps {
  params: { id: string, chartName: string };
  searchParams: { [key: string]: string };
}

export default async function ScenarioPage({ params, searchParams }: CreateScenarioPageProps) {
  const { id: workspaceId, chartName } = params;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return null;
  }
  const session = await validateSession(sessionToken);
  if (!session) {
    return null;
  }

  const workspace = await getWorkspaceAction(session, workspaceId);
  if (!workspace) {
    return null;
  }

  const chart = workspace?.charts.find(chart => chart.name === chartName);
  if (!chart) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <TopNav />
      <div className="flex-1">
        <ScenarioForm
          workspace={workspace}
          chartId={chart.id}
        />
      </div>
      <CommandMenuWrapper />
    </div>
  );
}
