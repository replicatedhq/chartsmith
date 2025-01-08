import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getParam } from '../data/param';
import { getDB } from '../data/db';

const algorithm = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION!; // Your base64 key
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encryptToken(token: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');

  const cipher = createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV, encrypted data, and auth tag into single string
  return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')])
    .toString('base64');
}

function decryptToken(encryptedData: string): string {
  const buff = Buffer.from(encryptedData, 'base64');

  // Extract the parts
  const iv = buff.subarray(0, IV_LENGTH);
  const authTag = buff.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedText = buff.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

// Modified version of your function
export async function setUserReplicatedToken(userId: string, token: string): Promise<void> {
  try {
    const encryptedToken = encryptToken(token);
    const db = getDB(await getParam("DB_URI"));
    await db.query(
      `
        UPDATE chartsmith_user
        SET replicated_token = $1
        WHERE id = $2
      `,
      [encryptedToken, userId],
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// And a function to retrieve it
export async function getUserReplicatedToken(userId: string): Promise<string> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
        SELECT replicated_token
        FROM chartsmith_user
        WHERE id = $1
      `,
      [userId],
    );

    if (!result.rows[0]?.replicated_token) {
      throw new Error('Token not found');
    }

    return decryptToken(result.rows[0].replicated_token);
  } catch (err) {
    console.error(err);
    throw err;
  }
}
