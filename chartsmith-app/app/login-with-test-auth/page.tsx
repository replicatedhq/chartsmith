import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateTestAuth } from "@/lib/auth/actions/test-auth";

export default async function TestAuthPage() {
  // Check if test auth is enabled
  if (process.env.NODE_ENV === 'production') {
    redirect('/auth-error?error=test_auth_not_available_in_production');
  }

  if (process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
    redirect('/auth-error?error=test_auth_not_enabled');
  }

  try {
    // Generate JWT server-side
    const jwt = await validateTestAuth();

    if (!jwt) {
      redirect('/auth-error?error=test_auth_failed_null_jwt');
    }

    // Set cookie server-side using Next.js cookies API
    const cookieStore = await cookies();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 days from now

    cookieStore.set('session', jwt, {
      expires,
      path: '/',
      sameSite: 'lax',
      httpOnly: false, // Must be false so client-side hooks can read it
      secure: process.env.NODE_ENV === 'production',
    });

    // Redirect to home page
    redirect('/');
  } catch (error) {
    console.error("Test auth failed:", error);
    redirect(`/auth-error?error=test_auth_exception&message=${encodeURIComponent((error as Error)?.toString() || "Unknown error")}`);
  }
} 