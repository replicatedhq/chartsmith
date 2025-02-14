"use server"

import { sessionToken } from "../session";
import { createSession } from "../session";
import { GoogleUserProfile } from "../types";
import { upsertUser } from "../user";


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

  const user = await upsertUser(profile.email, profile.name, profile.picture);

  const sess = await createSession(user);
  const jwt = await sessionToken(sess);
  return jwt;
}
