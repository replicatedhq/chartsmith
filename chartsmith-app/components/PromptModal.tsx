"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { PromptInput } from "./PromptInput";
import { useSession } from "@/app/hooks/useSession";
import { useRouter } from "next/navigation";
import { createWorkspaceFromPromptAction, createWorkspaceForAiSdkAction } from "@/lib/workspace/actions/create-workspace-from-prompt";
import { getGoogleAuthUrl } from "@/lib/auth/google";
import { logger } from "@/lib/utils/logger";

// Key for storing the initial prompt in localStorage
const INITIAL_PROMPT_KEY = "chartsmith_initial_prompt";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptModal({ isOpen, onClose }: PromptModalProps) {
  const { isLoading, session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();

  const [error, setError] = React.useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = React.useState(false);

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

  const handleClose = useCallback(() => {
    setError(null);
    setIsPageLoading(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, handleClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsPageLoading(false);
    }
  }, [isOpen]);

  if (isLoading) {
    return null;
  }

  const createFromPrompt = async (prompt: string) => {
    try {
      setIsPageLoading(true);
      setError(null);

      if (!session) {
        // Need Google OAuth to authenticate - check if it's configured
        if (!publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
          setError("Authentication not configured. Please contact support.");
          setIsPageLoading(false);
          return;
        }
        try {
          // Store the prompt before redirecting to auth
          localStorage.setItem('pendingPrompt', prompt);
          // Redirect to Google Auth using the proper OAuth URL
          const authUrl = getGoogleAuthUrl(publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID, publicEnv.NEXT_PUBLIC_GOOGLE_REDIRECT_URI);
          window.location.href = authUrl;
        } catch (error) {
          logger.error("Failed to initiate Google login", { error });
          setError("Failed to initiate Google login. Please try again.");
          setIsPageLoading(false);
        }
        return;
      }

      // Check if AI SDK is enabled
      const useAiSdk = publicEnv.NEXT_PUBLIC_USE_VERCEL_AI_SDK === "true";

      if (useAiSdk) {
        // Create workspace without initial message - client will handle chat
        const w = await createWorkspaceForAiSdkAction(session);

        // Store prompt for the workspace page to pick up
        localStorage.setItem(INITIAL_PROMPT_KEY, JSON.stringify({
          workspaceId: w.id,
          prompt: prompt,
        }));

        router.push(`/workspace/${w.id}`);
      } else {
        // Original flow: create workspace with message through work queue
        const w = await createWorkspaceFromPromptAction(session, prompt);
        router.push(`/workspace/${w.id}`);
      }
    } catch (err) {
      logger.error("Failed to create workspace", { err });
      setError(err instanceof Error ? err.message : "Failed to create workspace");
      setIsPageLoading(false);  // Only reset loading on error
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-2xl rounded-lg shadow-lg border ${theme === "dark" ? "bg-surface border-border" : "bg-white border-gray-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-border" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Create Chart from Prompt</h2>
          </div>
          <button onClick={handleClose} className={`${theme === "dark" ? "text-white hover:text-white/80" : "text-gray-500 hover:text-gray-700"} transition-colors`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {error && <div className="mb-4 p-4 bg-error/10 text-red-500 rounded-lg border border-red-200">{error}</div>}
          <PromptInput onSubmit={createFromPrompt} isLoading={isLoading} className={theme === "dark" ? "bg-surface" : ""} />
        </div>
      </div>
    </div>
  );
}
