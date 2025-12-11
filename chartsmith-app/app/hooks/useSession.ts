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

  const [session, setSession] = useState<(Session) | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getCookieValue = (name: string): string | undefined => {
      const cookies = document.cookie.split("; ");
      const cookie = cookies.find((c) => c.trim().startsWith(`${name}=`));
      if (!cookie) return undefined;
      
      // Get the value after the = sign
      const value = cookie.split("=").slice(1).join("=");
      // URL decode the value (cookies might be encoded)
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    let mounted = true; // Track if component is still mounted

    // In test mode, try to get token from cookie, but if not found, wait a bit
    // (middleware might be setting it asynchronously)
    const checkForSession = async () => {
      let token = getCookieValue("session");
      
      // If no token and we're in test mode, wait a bit for middleware to set it
      // But only check once to avoid infinite loops
      if (!token && process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true') {
        logger.debug("No session cookie found in test mode, waiting...");
        // Wait up to 2 seconds for cookie to appear (only once)
        for (let i = 0; i < 4 && mounted; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (!mounted) return; // Component unmounted, stop
          token = getCookieValue("session");
          if (token) {
            logger.debug("Session cookie found after waiting");
            break;
          }
        }
      }

      if (!mounted) return; // Component unmounted during wait

      if (!token) {
        logger.debug("No session cookie found", { 
          allCookies: document.cookie,
          cookieCount: document.cookie.split(';').filter(c => c.trim()).length
        });
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      logger.debug("Found session cookie, validating...", { tokenPrefix: token.substring(0, 30) + '...' });

      const validate = async (token: string) => {
        if (!mounted) return; // Check again before async operation
        
        try {
          const sess = await validateSession(token);
          if (!mounted) return; // Check after async operation
          
          if (!sess) {
            logger.warn("Session validation returned undefined", { tokenPrefix: token.substring(0, 30) + '...' });
            if (redirectIfNotLoggedIn && mounted) {
              router.replace("/");
            }
            if (mounted) {
              setIsLoading(false);
            }
            return;
          }

          logger.debug("Session validated successfully", { userId: sess.user.id, email: sess.user.email });
          if (mounted) {
            setSession(sess);
            setIsLoading(false);
          }
        } catch (error) {
          if (!mounted) return;
          logger.error("Session validation failed:", error);
          if (redirectIfNotLoggedIn && mounted) {
            router.replace("/");
          }
          if (mounted) {
            setIsLoading(false);
          }
        }
      };

      validate(token);
    };

    checkForSession();
    
    return () => {
      mounted = false; // Cleanup: mark as unmounted
    };
  }, [router, redirectIfNotLoggedIn]); // Only run once on mount

  return {
    isLoading,
    session,
  };
};
