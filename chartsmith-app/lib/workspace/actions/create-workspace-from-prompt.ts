"use server";

import { ChatMessageFromPersona, CreateChatMessageParams, createWorkspace } from "../workspace";
import { Workspace } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import { cookies } from "next/headers";
import { findSession } from "@/lib/auth/session";
import { getTestAuthTokenFromHeaders, validateTestAuthToken, isTestAuthBypassEnabled } from "@/lib/auth/test-auth-bypass";
import { headers } from "next/headers";
import { getSessionFromRequest } from "@/lib/auth/get-session-from-request";

export async function createWorkspaceFromPromptAction(prompt: string): Promise<Workspace> {
  try {
    logger.info("Creating workspace from prompt", { prompt: prompt.substring(0, 100) });

    // Get session using the helper function that supports multiple auth methods:
    // 1. Test auth bypass header (test mode only)
    // 2. Session cookie (web)
    // 3. Authorization Bearer token (extension)
    let requestHeaders;
    try {
      requestHeaders = await headers();
      logger.debug("Got request headers", { hasHeaders: !!requestHeaders });
    } catch (headerError) {
      logger.error("Failed to get headers", { error: headerError });
      throw new Error("Failed to access request headers");
    }

    let session;
    try {
      session = await getSessionFromRequest(requestHeaders);
      logger.debug("Got session from request", { hasSession: !!session, hasUserId: !!session?.user?.id });
    } catch (sessionError) {
      logger.error("Failed to get session from request", { error: sessionError });
      throw new Error("Failed to authenticate: " + (sessionError instanceof Error ? sessionError.message : String(sessionError)));
    }
    
    if (!session?.user?.id) {
      logger.warn("No session found in server action", {
        hasHeaders: !!requestHeaders,
        testAuthEnabled: isTestAuthBypassEnabled(),
        hasSession: !!session,
        sessionKeys: session ? Object.keys(session) : []
      });
      throw new Error("Unauthorized: No session found");
    }

    const userId = session.user.id;
    logger.info("Got session in server action", { userId });

    const createChartMessageParams: CreateChatMessageParams = {
      prompt: prompt,
      messageFromPersona: ChatMessageFromPersona.AUTO,
    }
    
    logger.info("Calling createWorkspace", { userId, createdType: "prompt", promptLength: prompt.length });
    let w: Workspace;
    try {
      w = await createWorkspace("prompt", userId, createChartMessageParams);
      logger.info("Workspace created successfully", { workspaceId: w.id });
    } catch (workspaceError) {
      logger.error("createWorkspace threw error", {
        error: workspaceError,
        errorMessage: workspaceError instanceof Error ? workspaceError.message : String(workspaceError),
        errorStack: workspaceError instanceof Error ? workspaceError.stack : undefined
      });
      throw workspaceError;
    }

    // Verify workspace is valid before returning
    if (!w || !w.id) {
      logger.error("Invalid workspace returned from createWorkspace", { workspace: w });
      throw new Error("Failed to create workspace: Invalid workspace returned");
    }

    logger.info("Returning workspace", { workspaceId: w.id, hasCharts: w.charts.length > 0, hasFiles: w.files.length > 0 });
    return w;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Error in createWorkspaceFromPromptAction", {
      errorMessage,
      errorStack,
      promptLength: prompt.length,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Ensure error is serializable for Next.js server actions
    // Re-throw as a plain Error with just the message to avoid serialization issues
    throw new Error(`Failed to create workspace: ${errorMessage}`);
  }
}
