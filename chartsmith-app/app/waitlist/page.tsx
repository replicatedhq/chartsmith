"use client";

import { useSession } from "@/app/hooks/useSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { checkWaitlistStatusAction } from "@/lib/auth/actions/check-waitlist-status";

export default function WaitlistPage() {
  const { session, isLoading } = useSession();
  const router = useRouter();

  // Check if the user has been approved on page load
  useEffect(() => {
    async function checkApprovalStatus() {
      console.log(session);
      if (!isLoading && session && session.isWaitlisted) {
        if (!session) return;

        try {
          const newJWT = await checkWaitlistStatusAction(session);

          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `session=${newJWT}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

          // if the jwt no longer has the isWaitlisted claim, redirect to home
          if (!session.user.isWaitlisted) {
            window.location.href = "/";
          }
        } catch (error) {
          console.error("Failed to check waitlist status:", error);
        }
      }
    }

    checkApprovalStatus();
  }, [session, isLoading]);

  // Redirect to home if user is not waitlisted
  useEffect(() => {
    if (!isLoading && session && !session.isWaitlisted) {
      router.push("/");
    }
  }, [session, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-app">
        <div className="animate-pulse text-text">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app">
      <Card className="w-full max-w-lg p-8 text-center shadow-lg border-border">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4 text-text">You're on the waitlist!</h1>
          <p className="text-text/80 mb-4">
            Thank you for your interest in ChartSmith. We're currently in private beta and will reach out to you soon.
          </p>
          <p className="text-text/80">
            We appreciate your patience and can't wait to have you on board.
          </p>
        </div>

        <div className="mt-8">
          <Button
            variant="default"
            onClick={() => router.push("/")}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Return to Home
          </Button>
        </div>
      </Card>
    </div>
  );
}