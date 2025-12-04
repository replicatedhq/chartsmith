"use server";

import { Session } from "@/lib/types/session";
import { ChatMessage } from "@/lib/types/workspace";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { ChatMessageFromPersona } from "../workspace";
import * as srs from "secure-random-string";

/**
 * Creates a chat message for AI SDK usage.
 * 
 * This action bypasses the standard createChatMessage function which triggers
 * Go backend intent processing via enqueueWork("new_intent"). For AI SDK messages,
 * we want to handle the response ourselves without Go intervention.
 * 
 * @param session - User session
 * @param workspaceId - Workspace ID
 * @param message - User message content
 * @returns Created ChatMessage
 */
export async function createAISDKChatMessageAction(
  session: Session,
  workspaceId: string,
  message: string
): Promise<ChatMessage> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDB(await getParam("DB_URI"));
  const id = srs.default({ length: 12, alphanumeric: true });
  const now = new Date();

  // Get the current workspace revision number
  const workspaceResult = await db.query(
    `SELECT current_revision_number FROM workspace WHERE id = $1`,
    [workspaceId]
  );

  if (workspaceResult.rows.length === 0) {
    throw new Error("Workspace not found");
  }

  const revisionNumber = workspaceResult.rows[0].current_revision_number;

  // Insert directly into workspace_chat, skipping the enqueueWork("new_intent") call
  // that exists in the standard createChatMessage() function.
  // 
  // Required columns from schema:
  // - id (NOT NULL)
  // - workspace_id (NOT NULL)
  // - revision_number (NOT NULL)
  // - created_at (NOT NULL)
  // - sent_by (NOT NULL)
  // - prompt (NOT NULL)
  // - is_intent_complete (NOT NULL, default false)
  // - is_canceled (NOT NULL, default false)
  await db.query(
    `INSERT INTO workspace_chat (
      id,
      workspace_id,
      revision_number,
      created_at,
      sent_by,
      prompt,
      response,
      is_intent_complete,
      is_intent_conversational,
      is_intent_plan,
      is_intent_off_topic,
      is_canceled,
      message_from_persona
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,                              // $1 id
      workspaceId,                     // $2 workspace_id
      revisionNumber,                  // $3 revision_number
      now,                             // $4 created_at
      session.user.id,                 // $5 sent_by
      message,                         // $6 prompt
      null,                            // $7 response (will be updated later)
      true,                            // $8 is_intent_complete (true - AI SDK handles intent)
      true,                            // $9 is_intent_conversational (default to conversational)
      false,                           // $10 is_intent_plan
      false,                           // $11 is_intent_off_topic
      false,                           // $12 is_canceled
      ChatMessageFromPersona.AUTO,     // $13 message_from_persona
    ]
  );

  return {
    id,
    prompt: message,
    response: "", // Empty string - AI response will be filled later
    createdAt: now,
    isCanceled: false,
    isIntentComplete: true,
    isComplete: true,
    revisionNumber,
    messageFromPersona: ChatMessageFromPersona.AUTO,
  } as ChatMessage;
}

