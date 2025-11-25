import { redirect } from "next/navigation";

/**
 * Test auth page - redirects to the API route handler which can properly set cookies.
 * In Next.js 15, Server Components cannot set cookies directly, so we delegate to a Route Handler.
 */
export default async function TestAuthPage() {
  // Check if test auth is enabled
  if (process.env.NODE_ENV === 'production') {
    redirect('/auth-error?error=test_auth_not_available_in_production');
  }

  if (process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
    redirect('/auth-error?error=test_auth_not_enabled');
  }

  // Redirect to API route which can set cookies in Next.js 15
  redirect('/api/test-auth');
} 