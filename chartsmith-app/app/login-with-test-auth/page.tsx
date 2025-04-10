"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { validateTestAuth } from "@/lib/auth/actions/test-auth";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function TestAuthPage() {
  const router = useRouter();
  const [publicEnv, setPublicEnv] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const data = await res.json();
        setPublicEnv(data);
      } catch (err) {
        console.error("Failed to load public env config:", err);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    async function handleTestAuth() {
      if (publicEnv.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
        console.log("Test auth is not enabled, pushing to home");
        router.push('/');
        return;
      }

      try {
        const jwt = await validateTestAuth();
        if (jwt) {
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `session=${jwt}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
          window.location.href = '/';
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error("Test auth failed:", error);
        router.push('/');
      }
    }

    handleTestAuth();
  }, [router]);

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <h2 className="text-2xl font-bold">Logging you in</h2>
          </div>
          <p className="text-sm text-muted-foreground">Please wait while we complete test authentication...</p>
        </div>
      </Card>
    </div>
  );
}
