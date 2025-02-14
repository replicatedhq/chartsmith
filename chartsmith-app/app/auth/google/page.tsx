"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/toast/use-toast";
import { Card } from "@/components/ui/Card";
import { exchangeGoogleCodeForSession } from "@/lib/auth/actions/exchange-google-code";
import { createWorkspaceFromPromptAction } from "@/lib/workspace/actions/create-workspace-from-prompt";
import { findSession } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";
import { createWorkspaceFromUrlAction } from "@/lib/workspace/actions/create-workspace-from-url";

function GoogleCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const exchangeComplete = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      router.push("/auth/error");
      return;
    }

    if (!exchangeComplete.current) {
      exchangeComplete.current = true;

      exchangeGoogleCodeForSession(code)
        .then(async (jwt) => {
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `session=${jwt}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

          // Check for stored ArtifactHub URL first
          const pendingArtifactHubUrl = sessionStorage.getItem('pendingArtifactHubUrl');
          if (pendingArtifactHubUrl) {
            try {
              sessionStorage.removeItem('pendingArtifactHubUrl');
              const session = await findSession(jwt);
              if (!session) {
                throw new Error("Failed to get session");
              }
              const w = await createWorkspaceFromUrlAction(session, pendingArtifactHubUrl);
              window.location.href = `/workspace/${w.id}`;
              return;
            } catch (error) {
              logger.error("Failed to create workspace from ArtifactHub URL:", error);
              window.location.href = "/";
              return;
            }
          }

          // Check for stored prompt if no ArtifactHub URL
          const pendingPrompt = sessionStorage.getItem('pendingPrompt');
          if (pendingPrompt) {
            try {
              sessionStorage.removeItem('pendingPrompt');
              const session = await findSession(jwt);
              if (!session) {
                throw new Error("Failed to get session");
              }
              const w = await createWorkspaceFromPromptAction(session, pendingPrompt);
              window.location.href = `/workspace/${w.id}`;
            } catch (error) {
              logger.error("Failed to create workspace from prompt:", error);
              window.location.href = "/";
            }
          } else {
            window.location.href = "/";
          }
        })
        .catch((error) => {
          logger.error("Auth Error:", error);
          router.push("/auth/error");
        });
    }
  }, [searchParams, router, toast]);

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <h2 className="text-2xl font-bold">Logging you in</h2>
          </div>

          <p className="text-sm text-muted-foreground">Please wait while we complete your Google log in...</p>
        </div>
      </Card>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md p-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Loading...</p>
            </div>
          </Card>
        </div>
      }
    >
      <GoogleCallback />
    </Suspense>
  );
}
