"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeGoogleCodeForSession } from "@/lib/auth/actions/exchange-google-code";
import { logger } from "@/lib/utils/logger";

function GoogleCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      window.opener?.postMessage({ type: 'google-auth', error: true }, window.location.origin);
      return;
    }

    console.log("exchanging google code for session");
    exchangeGoogleCodeForSession(code)
      .then((jwt) => {
        try {
          // Try to parse JWT to check waitlist status
          let isWaitlisted = false;
          try {
            const payload = JSON.parse(atob(jwt.split('.')[1]));
            console.log("JWT payload:", payload);
            isWaitlisted = payload.isWaitlisted === true;
          } catch (e) {
            // If it's a test token, try to extract info differently
            if (jwt.startsWith('test-token-')) {
              console.log("Test token received, checking waitlist status...");
            } else {
              logger.error("Failed to parse JWT:", e);
            }
          }

          // Set cookie first
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `session=${jwt}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

          // Handle popup vs direct navigation
          if (window.opener) {
            // Popup window - send message to opener
            window.opener.postMessage({ type: 'google-auth', jwt }, window.location.origin);
            if (isWaitlisted) {
              window.opener.location.href = '/waitlist';
            } else {
              window.opener.location.href = '/';
            }
            window.close();
          } else {
            // Direct navigation - redirect directly
            if (isWaitlisted) {
              router.push('/waitlist');
            } else {
              router.push('/');
            }
          }
        } catch (e) {
          logger.error("Failed to handle auth response:", e);
          if (window.opener) {
            window.opener.postMessage({ type: 'google-auth', error: true }, window.location.origin);
            window.close();
          } else {
            router.push('/login?error=auth_failed');
          }
        }
      })
      .catch((error) => {
        logger.error("Auth Error:", error);
        if (window.opener) {
          window.opener.postMessage({ type: 'google-auth', error: true }, window.location.origin);
          window.close();
        } else {
          router.push('/login?error=auth_failed');
        }
      });
  }, [searchParams, router]);

  return null;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallback />
    </Suspense>
  );
}
