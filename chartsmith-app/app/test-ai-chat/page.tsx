"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { createWorkspaceFromPromptAction } from "@/lib/workspace/actions/create-workspace-from-prompt";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { Send, Loader2 } from "lucide-react";

/**
 * Test AI Chat Landing Page
 * 
 * Allows users to create a new workspace from a prompt and redirects
 * to the test-ai-chat workspace page.
 */
export default function TestAIChatLandingPage() {
  const router = useRouter();
  const { session } = useSession();
  const { theme } = useTheme();
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !session || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const workspace = await createWorkspaceFromPromptAction(session, prompt.trim());
      // Navigate to workspace - the prompt is already persisted to DB by createWorkspaceFromPromptAction
      router.push(`/test-ai-chat/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <EditorLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-8">
        <div className="max-w-2xl w-full">
          <h1 className={`text-3xl font-bold mb-2 text-center ${
            theme === "dark" ? "text-white" : "text-gray-900"
          }`}>
            AI SDK Test Chat
          </h1>
          <p className={`text-center mb-8 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Describe your Helm chart and I&apos;ll help you build it
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your Helm chart... (e.g., 'Create a PostgreSQL deployment with persistent storage')"
              rows={4}
              disabled={isCreating}
              className={`w-full px-4 py-3 rounded-lg border ${
                theme === "dark"
                  ? "bg-dark-surface border-dark-border text-white placeholder-gray-500"
                  : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
              } focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none`}
            />

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={!prompt.trim() || isCreating || !session}
              className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                ${prompt.trim() && session && !isCreating
                  ? "bg-primary text-white hover:bg-primary/90"
                  : theme === "dark"
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating workspace...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Start Building
                </>
              )}
            </button>
          </form>

          {!session && (
            <p className={`text-center mt-4 text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
              Please log in to create a workspace
            </p>
          )}
        </div>
      </div>
    </EditorLayout>
  );
}
