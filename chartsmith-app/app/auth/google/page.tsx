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

    exchangeGoogleCodeForSession(code)
      .then((jwt) => {
        // Check if user is waitlisted
        try {
          const payload = JSON.parse(atob(jwt.split('.')[1]));
          if (payload.isWaitlisted) {
            window.opener?.postMessage({ type: 'google-auth', jwt }, window.location.origin);
            if (window.opener) {
              window.opener.location.href = '/waitlist';
              window.close();
            } else {
              router.push('/waitlist');
            }
            return;
          }
        } catch (e) {
          logger.error("Failed to parse JWT:", e);
        }

        window.opener?.postMessage({ type: 'google-auth', jwt }, window.location.origin);
      })
      .catch((error) => {
        logger.error("Auth Error:", error);
        window.opener?.postMessage({ type: 'google-auth', error: true }, window.location.origin);
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
