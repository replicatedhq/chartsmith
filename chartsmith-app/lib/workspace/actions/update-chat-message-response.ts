"use server";

import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { RawFollowupAction } from "@/components/types";

/**
 * Updates the response field of a chat message.
 * 
 * This action is used by the AI SDK test path to persist AI responses.
 * 
 * Note: The workspace_chat table does NOT have an updated_at column,
 * so we only update response, is_intent_complete, and followup_actions fields.
 * 
 * @param session - User session (for authorization)
 * @param chatMessageId - Chat message ID to update
 * @param response - AI response content
 * @param isComplete - Whether the intent is complete (default true)
 * @param followupActions - PR3.0: Rule-based followup actions to display
 */
export async function updateChatMessageResponseAction(
  session: Session,
  chatMessageId: string,
  response: string,
  isComplete: boolean = true,
  followupActions?: RawFollowupAction[]
): Promise<void> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDB(await getParam("DB_URI"));

  // NOTE: workspace_chat table does NOT have updated_at column!
  // Update response, is_intent_complete, and followup_actions
  await db.query(
    `UPDATE workspace_chat
     SET response = $1,
         is_intent_complete = $2,
         followup_actions = $3
     WHERE id = $4`,
    [
      response,
      isComplete,
      JSON.stringify(followupActions ?? []),
      chatMessageId,
    ]
  );
}

