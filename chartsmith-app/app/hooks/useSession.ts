"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@/lib/types/session";
import { validateSession } from "@/lib/auth/actions/validate-session";

export const useSession = (redirectIfNotLoggedIn: boolean = true) => {
  const [session, setSession] = useState<Session | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find(cookie => cookie.startsWith("session="))
      ?.split("=")[1];

    if (!token && redirectIfNotLoggedIn) {
      router.replace("/");
      return;
    } else if (!token) {
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
        console.log('setting loading to false')
        setIsLoading(false);
      } catch (error) {
        console.error("Session validation failed:", error);
        if (redirectIfNotLoggedIn) {
          router.replace("/");
        }
      }
    };

    validate(token);
  }, [router]);

  return {
    isSessionLoading: isLoading,
    session
  };
};
