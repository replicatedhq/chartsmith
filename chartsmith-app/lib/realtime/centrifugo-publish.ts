import { logger } from "../utils/logger";
import { getParam } from "../data/param";
import { getDB } from "../data/db";
import * as srs from "secure-random-string";

interface CentrifugoPublishData {
  eventType: string;
  data: any;
}

/**
 * Publishes a message to Centrifugo and stores it for replay
 */
export async function publishToCentrifugo(
  workspaceId: string,
  userId: string,
  event: CentrifugoPublishData
): Promise<void> {
  try {
    const centrifugoApiUrl = process.env.CENTRIFUGO_API_URL || "http://localhost:8000/api";
    const centrifugoApiKey = process.env.CENTRIFUGO_API_KEY;

    if (!centrifugoApiKey) {
      throw new Error("CENTRIFUGO_API_KEY is not set");
    }

    const channel = `${workspaceId}#${userId}`;

    // Flatten the event data to match what the frontend expects
    // Frontend expects: { eventType: "...", ...otherFields }
    const messageData = {
      eventType: event.eventType,
      workspaceId,
      ...event.data,
    };

    // Publish to Centrifugo
    const response = await fetch(`${centrifugoApiUrl}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": centrifugoApiKey,
      },
      body: JSON.stringify({
        channel,
        data: messageData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Centrifugo publish failed: ${response.status} ${errorText}`);
    }

    // Store for replay
    await storeReplayEvent(userId, messageData);

    logger.debug("Published to Centrifugo", { channel, eventType: event.eventType });
  } catch (err) {
    logger.error("Failed to publish to Centrifugo", { err, workspaceId, userId });
    // Don't throw - we don't want to break the chat flow if Centrifugo is down
  }
}

/**
 * Stores an event for replay when clients reconnect
 */
async function storeReplayEvent(userId: string, messageData: any): Promise<void> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const id = srs.default({ length: 12, alphanumeric: true });

    await db.query(
      `INSERT INTO realtime_replay (id, user_id, message_data, created_at) VALUES ($1, $2, $3, NOW())`,
      [id, userId, JSON.stringify(messageData)]
    );

    // Clean up old replay events (older than 10 seconds)
    await db.query(
      `DELETE FROM realtime_replay WHERE created_at < NOW() - INTERVAL '10 seconds'`
    );
  } catch (err) {
    logger.error("Failed to store replay event", { err });
    // Don't throw
  }
}

/**
 * Publishes a chat message update event
 */
export async function publishChatMessageUpdate(
  workspaceId: string,
  userId: string,
  chatMessageId: string,
  chunk: string,
  isComplete: boolean
): Promise<void> {
  await publishToCentrifugo(workspaceId, userId, {
    eventType: "chatmessage-updated",
    data: {
      id: chatMessageId,
      chunk,
      isComplete,
    },
  });
}
