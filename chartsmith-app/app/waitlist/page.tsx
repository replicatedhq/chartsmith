"use client";

import { useSession } from "@/app/hooks/useSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export default function WaitlistPage() {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const { resolvedTheme } = useTheme();

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