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

  return { session, workspace };
}

export default async function WorkspaceLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = await params;
  const { workspace } = await getSessionAndWorkspace(id);

  return (
    <WorkspaceUIProvider>
      <div className="min-h-screen bg-[var(--background)] flex w-full" suppressHydrationWarning>
        {workspace.files.length > 0 && (
          <SideNav
            workspaceID={id}
            isChatVisible={true}
            isFileTreeVisible={true}
          />
        )}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </WorkspaceUIProvider>
  );
}
