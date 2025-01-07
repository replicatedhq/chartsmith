"use client";

import React, { useCallback, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { PromptInput } from "./PromptInput";
import { useSession } from "@/app/hooks/useSession";
import { useRouter } from "next/navigation";
import { createWorkspaceAction } from "@/lib/workspace/actions/create-workspace-from-prompt";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptModal({ isOpen, onClose }: PromptModalProps) {
  const { isSessionLoading, session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();

  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClose = useCallback(() => {
    setError(null);
    setIsLoading(false);
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
      setIsLoading(false);
    }
  }, [isOpen]);

  if (isSessionLoading) {
    return null;
  }

  const createFromPrompt = async (prompt: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const workspaceId = await createWorkspaceAction(session!, "prompt", prompt);
      
      // Don't reset loading state, let it persist through redirect
      router.push(`/workspace/${workspaceId}`);
    } catch (err) {
      console.error("Failed to create workspace:", err);
      setError(err instanceof Error ? err.message : "Failed to create workspace");
      setIsLoading(false);  // Only reset loading on error
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
