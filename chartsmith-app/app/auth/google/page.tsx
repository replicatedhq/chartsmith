"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { exchangeGoogleCodeForSession } from "@/lib/auth/actions/exchange-google-code";
import { logger } from "@/lib/utils/logger";

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      window.opener?.postMessage({ type: 'google-auth', error: true }, window.location.origin);
      return;
    }

    exchangeGoogleCodeForSession(code)
      .then((jwt) => {
        window.opener?.postMessage({ type: 'google-auth', jwt }, window.location.origin);
      })
      .catch((error) => {
        logger.error("Auth Error:", error);
        window.opener?.postMessage({ type: 'google-auth', error: true }, window.location.origin);
      });
  }, [searchParams]);

  return null;
}
