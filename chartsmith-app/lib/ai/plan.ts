/**
 * PR3.0: Plan Creation Client
 *
 * Provides TypeScript client for the Go /api/plan/create-from-tools endpoint.
 * Used to create plan records from buffered tool calls after AI SDK streaming completes.
 */

import { callGoEndpoint } from "./tools/utils";
import { BufferedToolCall } from "./tools/toolInterceptor";

interface CreatePlanRequest {
  workspaceId: string;
  chatMessageId: string;
  toolCalls: BufferedToolCall[];
}

interface CreatePlanResponse {
  planId: string;
}

/**
 * Creates a plan from buffered tool calls via Go backend
 *
 * This is called after AI SDK streaming completes (in onFinish callback).
 * The Go backend:
 * 1. Creates a plan record with status 'review'
 * 2. Stores the buffered tool calls in JSONB
 * 3. Sets response_plan_id on the chat message
 * 4. Publishes Centrifugo event for real-time UI update
 *
 * @param authHeader - Authorization header to forward to Go backend
 * @param workspaceId - The current workspace ID
 * @param chatMessageId - The chat message ID to associate with the plan
 * @param toolCalls - Array of buffered tool calls to store
 * @returns The created plan ID
 */
export async function createPlanFromToolCalls(
  authHeader: string | undefined,
  workspaceId: string,
  chatMessageId: string,
  toolCalls: BufferedToolCall[]
): Promise<string> {
  const response = await callGoEndpoint<CreatePlanResponse>(
    "/api/plan/create-from-tools",
    {
      workspaceId,
      chatMessageId,
      toolCalls,
    } as CreatePlanRequest,
    authHeader
  );

  return response.planId;
}

