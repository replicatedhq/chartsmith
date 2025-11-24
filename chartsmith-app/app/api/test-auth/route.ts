import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sessionToken, createSession } from '@/lib/auth/session';
import { GoogleUserProfile } from '@/lib/auth/types';
import { upsertUser } from '@/lib/auth/user';
import { getDB } from '@/lib/data/db';
import { getParam } from '@/lib/data/param';

export async function GET() {
  // Check if test auth is enabled
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/auth-error?error=test_auth_not_available_in_production', process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3000'));
  }

  if (process.env.ENABLE_TEST_AUTH !== 'true' && process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
    return NextResponse.redirect(new URL('/auth-error?error=test_auth_not_enabled', process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3000'));
  }

  const profile: GoogleUserProfile = {
    email: 'playwright@chartsmith.ai',
    name: 'Playwright Test User',
    picture: 'https://randomuser.me/api/portraits/lego/3.jpg',
    id: '123',
    verified_email: true,
  };

  try {
    const dbUri = await getParam("DB_URI");
    const db = getDB(dbUri);

    // First check if the test user already exists in waitlist
    const waitlistResult = await db.query(
      `SELECT id FROM waitlist WHERE email = $1`,
      [profile.email]
    );

    // If in waitlist, move them to regular user
    if (waitlistResult.rows.length > 0) {
      const waitlistId = waitlistResult.rows[0].id;

      await db.query("BEGIN");

      try {
        await db.query(
          `INSERT INTO chartsmith_user (
            id, email, name, image_url, created_at, last_login_at, last_active_at
          ) SELECT id, email, name, image_url, created_at, now(), now()
          FROM waitlist WHERE id = $1
          ON CONFLICT (email) DO NOTHING`,
          [waitlistId]
        );

        await db.query(`DELETE FROM waitlist WHERE id = $1`, [waitlistId]);
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    }

    // Create or get the user
    const user = await upsertUser(profile.email, profile.name, profile.picture);
    if (user.isWaitlisted) {
      user.isWaitlisted = false;
    }

    const sess = await createSession(user);
    const jwt = await sessionToken(sess);

    // Create response with redirect
    const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3000'));

    // Set session cookie
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    response.cookies.set('session', jwt, {
      expires,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error("Test auth failed:", error);
    return NextResponse.redirect(
      new URL(`/auth-error?error=test_auth_exception&message=${encodeURIComponent((error as Error)?.toString() || "Unknown error")}`,
      process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3000')
    );
  }
}
