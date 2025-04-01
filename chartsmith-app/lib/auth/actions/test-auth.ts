"use server"

import { sessionToken } from "../session";
import { createSession } from "../session";
import { GoogleUserProfile } from "../types";
import { upsertUser } from "../user";
import { getDB } from "../../data/db";
import { getParam } from "../../data/param";
import { logger } from "../../utils/logger";


export async function validateTestAuth(): Promise<string> {
  if (process.env.NODE_ENV == 'production') {
    throw new Error('Test auth is not allowed in production');
  }

  if (process.env.ENABLE_TEST_AUTH !== 'true') {
    throw new Error('Test auth is not enabled');
  }

  // upsert a user
  const profile: GoogleUserProfile = {
    email: 'playwright@chartsmith.ai',
    name: 'Playwright Test User',
    picture: 'https://randomuser.me/api/portraits/lego/3.jpg',
    id: '123',
    verified_email: true,
  }

  const db = getDB(await getParam("DB_URI"));
  
  // First check if the test user already exists in waitlist
  const waitlistResult = await db.query(
    `SELECT id FROM waitlist WHERE email = $1`,
    [profile.email]
  );
  
  // If in waitlist, move them to regular user
  if (waitlistResult.rows.length > 0) {
    const waitlistId = waitlistResult.rows[0].id;
    logger.info("Moving test user from waitlist to regular user", { email: profile.email });
    
    // Begin transaction
    await db.query("BEGIN");
    
    try {
      // Move from waitlist to main users table
      await db.query(
        `INSERT INTO chartsmith_user (
          id,
          email,
          name,
          image_url,
          created_at,
          last_login_at,
          last_active_at
        ) SELECT 
          id,
          email,
          name,
          image_url,
          created_at,
          now(),
          now()
        FROM waitlist WHERE id = $1
        ON CONFLICT (email) DO NOTHING`,
        [waitlistId]
      );
      
      // Delete from waitlist
      await db.query(
        `DELETE FROM waitlist WHERE id = $1`,
        [waitlistId]
      );
      
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      logger.error("Failed to move test user from waitlist", { error, email: profile.email });
    }
  }

  // Now create or get the user normally
  const user = await upsertUser(profile.email, profile.name, profile.picture);
  
  // If the user still has isWaitlisted = true, force set it to false for test users
  if (user.isWaitlisted) {
    user.isWaitlisted = false;
  }

  const sess = await createSession(user);
  const jwt = await sessionToken(sess);
  return jwt;
}
