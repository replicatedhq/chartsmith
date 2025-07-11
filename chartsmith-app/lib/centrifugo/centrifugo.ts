import { logger } from "@/lib/utils/logger";
import * as jwt from "jsonwebtoken";
import { getParam } from "../data/param";
import { getDB } from "../data/db";
interface CentrifugoClaims {
  sub: string;
  exp: number;
  iat: number;
  channels?: string[];
}

export async function listReplayableEvents(userID: string): Promise<any[]> {
  logger.debug("listReplayableEvents", { userID });
  try {
    const db =  getDB((await getParam("DB_URI")))
    const result = await db.query("SELECT message_data FROM realtime_replay WHERE user_id = $1", [userID]);
    const messages = result.rows.map((row) => row.message_data);
    return messages;
  } catch (err) {
    logger.error("Failed to list replayable events", { err });
    return [];
  }
}

export async function getCentrifugoToken(userID: string): Promise<string> {
  logger.debug("Getting centrifugo token for user", { userID });
  try {
    const nowInSeconds = Math.floor(Date.now() / 1000); // Convert milliseconds to seconds
    const claims: CentrifugoClaims = {
      sub: userID,
      exp: nowInSeconds + 60 * 60, // 1 hour from now
      iat: nowInSeconds, // Issued at current time in seconds
    };

    const jwtSigningKey = await getCentrifugoJwtSigningKey();

    // print the 1st 4 and last 4 of the jwtSigningKey to debug
    const key = jwtSigningKey.toString();
    const key1 = key.slice(0, 4);
    const key2 = key.slice(-4);
    logger.debug("JWT signing key", { key1, key2 });

    const token = jwt.sign(claims, jwtSigningKey, { algorithm: "HS256" });
    return token;
  } catch (err) {
    logger.error("Failed to get centrifugo token", { err });
    return "";
  }
}

async function getCentrifugoJwtSigningKey(): Promise<jwt.Secret> {
  const secret = process.env["CENTRIFUGO_TOKEN_HMAC_SECRET"];
  if (secret) {
    return secret.trim(); // Trim any leading/trailing whitespace
  }

  throw new Error("No JWT signing key found, set CENTRIFUGO_TOKEN_HMAC_SECRET");
}
