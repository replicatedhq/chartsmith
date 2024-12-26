"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@/lib/types/session";
import { validateSession } from "@/lib/auth/actions/validate-session";

export const useSession = (redirectIfNotLoggedIn: boolean = false) => {
  const [session, setSession] = useState<Session | undefined>({
    user: {
      id: 'default-user',
      email: 'default@example.com',
      name: 'Default User'
    }
  } as Session);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find(cookie => cookie.startsWith("session="))
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

        setSession(sess);
        setIsLoading(false);
      } catch (error) {
        console.error("Session validation failed:", error);
        if (redirectIfNotLoggedIn) {
          router.replace("/");
        }
        setIsLoading(false);
      }
    };

    validate(token);
  }, [router, redirectIfNotLoggedIn]);

  return {
    isSessionLoading: isLoading,
    session
  };
};
