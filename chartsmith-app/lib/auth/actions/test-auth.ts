"use server"

import { sessionToken } from "../session";
import { createSession } from "../session";
import { GoogleUserProfile } from "../types";
import { upsertUser } from "../user";
import { getDB } from "../../data/db";
import { getParam } from "../../data/param";
import { logger } from "../../utils/logger";


export async function validateTestAuth(): Promise<string> {
  console.log("Starting validateTestAuth function");
  
  if (process.env.NODE_ENV == 'production') {
    throw new Error('Test auth is not allowed in production');
  }

  if (process.env.ENABLE_TEST_AUTH !== 'true' && process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
    console.error('Test auth environment variables:', {
      ENABLE_TEST_AUTH: process.env.ENABLE_TEST_AUTH,
      NEXT_PUBLIC_ENABLE_TEST_AUTH: process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH
    });
    throw new Error('Test auth is not enabled');
  }

  console.log("Environment variables check passed");

  // upsert a user
  const profile: GoogleUserProfile = {
    email: 'playwright@chartsmith.ai',
    name: 'Playwright Test User',
    picture: 'https://randomuser.me/api/portraits/lego/3.jpg',
    id: '123',
    verified_email: true,
  }
  
  console.log("Test user profile created:", profile);
  
  try {
    const dbUri = await getParam("DB_URI");
    console.log("DB_URI retrieved:", dbUri ? "URI exists (not showing for security)" : "URI is empty");
    
    const db = getDB(dbUri);
    console.log("Database connection established");

    // First check if the test user already exists in waitlist
    const waitlistResult = await db.query(
      `SELECT id FROM waitlist WHERE email = $1`,
      [profile.email]
    );
    console.log("Waitlist check result:", waitlistResult.rows.length > 0 ? "User in waitlist" : "User not in waitlist");
    
    // If in waitlist, move them to regular user
    if (waitlistResult.rows.length > 0) {
      const waitlistId = waitlistResult.rows[0].id;
      logger.info("Moving test user from waitlist to regular user", { email: profile.email });
      console.log("Moving test user from waitlist to regular user");
      
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
        console.log("Successfully moved user from waitlist");
      } catch (error) {
        await db.query("ROLLBACK");
        logger.error("Failed to move test user from waitlist", { error, email: profile.email });
        console.error("Failed to move test user from waitlist:", error);
        throw error; // Re-throw to be caught by outer try/catch
      }
    }

    // Now create or get the user normally
    console.log("Creating or getting user");
    const user = await upsertUser(profile.email, profile.name, profile.picture);
    console.log("User created/retrieved:", user ? "Success" : "Failed");
    
    // If the user still has isWaitlisted = true, force set it to false for test users
    if (user.isWaitlisted) {
      user.isWaitlisted = false;
      console.log("Forced user.isWaitlisted to false");
    }

    const sess = await createSession(user);
    console.log("Session created");
    const jwt = await sessionToken(sess);
    console.log("JWT token generated");
    return jwt;
  } catch (error) {
    console.error("Error in validateTestAuth:", error);
    logger.error("Test auth failed", { error });
    throw error;
  }
}
