"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@/lib/types/session";
import { validateSession } from "@/lib/auth/actions/validate-session";

const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";

export const useSession = (redirectIfNotLoggedIn: boolean = true) => {
  const [session, setSession] = useState<Session | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (MOCK_AUTH) {
      const mockSession: Session = {
        id: "mock-session-id",
        user: {
          id: "mock-user-id",
          name: "Mock User",
          email: "mockuser@example.com",
          imageUrl: "https://via.placeholder.com/150",
          createdAt: new Date(),
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
      };
      setSession(mockSession);
      setIsLoading(false);
      return;
    }

    const token = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("session="))
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
  }, [router, redirectIfNotLoggedIn]);

  return {
    isSessionLoading: isLoading,
    session,
  };
};
