"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Shield, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/app/hooks/useSession";
import { authorizeExtensionAction } from "@/lib/auth/actions/authorize-extension";
import { useState, useEffect, Suspense } from "react";

function ExtensionAuthContent() {
  const { resolvedTheme } = useTheme();
  const { session } = useSession();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [publicEnv, setPublicEnv] = useState<Record<string, string>>({});
  const [isAuthorized, setIsAuthorized] = useState(false);

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

  const handleAuthorize = async () => {
    if (!session) {
      throw new Error("No session found")
    }

    if (!publicEnv.NEXT_PUBLIC_API_ENDPOINT) {
      throw new Error("No API endpoint found")
    }

    const token = await authorizeExtensionAction(session)

    if (next) {
      // Send auth data to the VS Code extension's local server
      fetch(next, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT,
        }),
      })
      .then(response => response.json())
      .then(() => {
        setIsAuthorized(true);
        // Don't close window immediately to show success message
        setTimeout(() => {
          window.close();
        }, 3000);
      })
      .catch(error => {
        console.error("Error authorizing extension:", error);
      });
    }
  };

  return (
    <div className={`relative flex h-screen w-screen flex-col items-center justify-center px-4 ${resolvedTheme === "dark" ? "bg-dark" : "bg-white"}`}>
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center space-x-2">
            {isAuthorized ? (
              <Check className="h-8 w-8 text-green-500" />
            ) : (
              <Shield className="h-8 w-8 text-primary" />
            )}
            <h2 className={`text-2xl font-bold ${resolvedTheme === "dark" ? "text-white" : "text-gray-900"}`}>
              {isAuthorized ? "Extension Authorized" : "Authorize Extension"}
            </h2>
          </div>

          {isAuthorized ? (
            <p className={`text-sm ${resolvedTheme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
              The VS Code extension has been successfully authorized. You can now close this window.
            </p>
          ) : (
            <p className={`text-sm ${resolvedTheme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
              Would you like to authorize the ChartSmith VS Code extension to access your account?
            </p>
          )}

          <div className="flex gap-4">
            {!isAuthorized && (
              <Button onClick={handleAuthorize}>Authorize</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ExtensionAuthPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ExtensionAuthContent />
    </Suspense>
  );
}