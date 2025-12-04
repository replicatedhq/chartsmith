import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/actions/validate-session";
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { TestAIChatClient } from "./client";

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Server component for the test AI chat workspace page.
 * 
 * Fetches workspace data and session on the server, then passes
 * to the client component for rendering.
 */
export default async function TestAIChatPage({ params }: PageProps) {
  const { workspaceId } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    redirect("/login");
  }

  const workspace = await getWorkspaceAction(session, workspaceId);
  if (!workspace) {
    redirect("/test-ai-chat");
  }

  // Fetch existing messages for history display
  const existingMessages = await getWorkspaceMessagesAction(session, workspaceId);

  return (
    <TestAIChatClient
      workspace={workspace}
      session={session}
      initialMessages={existingMessages}
    />
  );
}
