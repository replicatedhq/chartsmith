"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@/lib/types/session";
import { validateSession, extendSessionAction } from "@/lib/auth/actions/validate-session";
import { logger } from "@/lib/utils/logger";

export const useSession = (redirectIfNotLoggedIn: boolean = false) => {
  const extendSessionOnActivity = useCallback(async () => {
    const token = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("session="))
      ?.split("=")[1];

    if (token) {
      try {
        await extendSessionAction(token);
      } catch (error) {
        logger.error("Failed to extend session:", error);
      }
    }
  }, []);

  useEffect(() => {
    // Setup activity listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
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
  const [session, setSession] = useState<(Session & { isWaitlisted?: boolean }) | undefined>(undefined);
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

    const validate = async (token: string) => {
      try {
        const sess = await validateSession(token);
        if (!sess && redirectIfNotLoggedIn) {
          router.replace("/");
          return;
        }

        // Get the isWaitlisted claim from the JWT
        const tokenPayload = token.split('.')[1];
        if (tokenPayload) {
          try {
            const decodedData = JSON.parse(atob(tokenPayload));
            // Set the session with waitlist status
            setSession({
              ...sess,
              isWaitlisted: decodedData.isWaitlisted
            });
          } catch (err) {
            logger.error("Failed to decode JWT:", err);
            setSession(sess);
          }
        } else {
          setSession(sess);
        }
        
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
