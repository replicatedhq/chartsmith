"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@/lib/types/session";
import { validateSession, extendSessionAction } from "@/lib/auth/actions/validate-session";
import { logger } from "@/lib/utils/logger";

// Minimum interval between session extension calls (5 minutes)
const SESSION_EXTEND_MIN_INTERVAL_MS = 5 * 60 * 1000;

export const useSession = (redirectIfNotLoggedIn: boolean = false) => {
  // Track last time we extended the session to avoid excessive calls
  const lastExtendTimeRef = useRef<number>(0);

  const extendSessionOnActivity = useCallback(async () => {
    // Only extend session if at least 5 minutes have passed since last extension
    const now = Date.now();
    if (now - lastExtendTimeRef.current < SESSION_EXTEND_MIN_INTERVAL_MS) {
      return;
    }

    const token = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("session="))
      ?.split("=")[1];

    if (token) {
      try {
        // Decode the URL-encoded token
        const decodedToken = decodeURIComponent(token);
        await extendSessionAction(decodedToken);
        lastExtendTimeRef.current = now; // Update last extend time on success
      } catch (error) {
        logger.error("Failed to extend session:", error);
      }
    }
  }, []);

  useEffect(() => {
    // Setup activity listeners - only listen for significant events, not keydown
    // to avoid POST requests on every keystroke
    const events = ['mousedown', 'scroll', 'touchstart'];
    let activityTimeout: NodeJS.Timeout;

    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        extendSessionOnActivity();
      }, 1000); // Debounce session extension
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimeout(activityTimeout);
    };
  }, [extendSessionOnActivity]);

  const [session, setSession] = useState<(Session) | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("session="))
      ?.split("=")[1];

    if (!token) {
      setIsLoading(false);
      return;
    }

    const validate = async (encodedToken: string) => {
      try {
        // Decode the URL-encoded token
        const token = decodeURIComponent(encodedToken);
        const sess = await validateSession(token);
        if (!sess && redirectIfNotLoggedIn) {
          router.replace("/");
          return;
        }

        setSession(sess);
        setIsLoading(false);
      } catch (error) {
        logger.error("Session validation failed:", error);
        if (redirectIfNotLoggedIn) {
          router.replace("/");
        }
        setIsLoading(false);
      }
    };

    validate(token);
  }, [router, redirectIfNotLoggedIn]);

  return {
    isLoading,
    session,
  };
};
