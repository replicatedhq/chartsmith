"use server"

import { SideNav } from "@/components/SideNav";
import { WorkspaceUIProvider } from "@/contexts/WorkspaceUIContext";
import { getWorkspace } from "@/lib/workspace/workspace";
import { validateSession } from "@/lib/auth/actions/validate-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getSessionAndWorkspace(workspaceId: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    redirect('/login');
  }

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    redirect('/');
  }

  return { session };
}

export default async function WorkspaceLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = await params;
  await getSessionAndWorkspace(id);

  return (
    <WorkspaceUIProvider initialChatVisible={true} initialFileTreeVisible={true}>
      <div className="min-h-screen bg-[var(--background)] flex w-full" suppressHydrationWarning>
        <SideNav workspaceID={id} />
        <div className="flex-1">
          {children}
        </div>
      </div>
    </WorkspaceUIProvider>
  );
}
