import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth/actions/validate-session";
import { redirect } from "next/navigation";
import { WorkspaceUIProvider } from "@/contexts/WorkspaceUIContext";

export const dynamic = 'force-dynamic';

export default async function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    redirect('/login');
  }

  return (
    <WorkspaceUIProvider initialChatVisible={false} initialFileTreeVisible={false}>
      <div className="min-h-screen bg-[var(--background)] flex w-full" suppressHydrationWarning>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </WorkspaceUIProvider>
  );
}
