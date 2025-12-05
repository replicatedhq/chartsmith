"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/hooks/useSession";
import { createWorkspaceFromPromptAction } from "@/lib/workspace/actions/create-workspace-from-prompt";
import { createWorkspaceFromArchiveAction } from "@/lib/workspace/actions/create-workspace-from-archive";
import { Upload, Search, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { ArtifactHubSearchModal } from "@/components/ArtifactHubSearchModal";
import { HomeNav } from "@/components/HomeNav";
import { Footer } from "@/components/Footer";
import { logger } from "@/lib/utils/logger";

const MAX_CHARS = 512;
const WARNING_THRESHOLD = 500;

/**
 * Test AI Chat Landing Page
 *
 * Mirrors the main landing page look and feel but routes to /test-ai-chat/[workspaceId]
 * Uses AI SDK v5 instead of the Go backend for chat.
 */
export default function TestAIChatLandingPage() {
  const router = useRouter();
  const { session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showArtifactHubSearch, setShowArtifactHubSearch] = useState(false);
  const [uploadType, setUploadType] = useState<'helm' | 'k8s' | null>(null);
  const [isApproachingLimit, setIsApproachingLimit] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus the textarea on mount
    textareaRef.current?.focus();
  }, []);

  // Check if input is approaching character limit
  useEffect(() => {
    setIsApproachingLimit(prompt.length >= WARNING_THRESHOLD);
  }, [prompt]);

  const handlePromptSubmit = async () => {
    if (!session) {
      sessionStorage.setItem('pendingPrompt', prompt.trim());
      router.push('/login');
      return;
    }

    if (prompt.trim()) {
      try {
        setIsPromptLoading(true);
        const w = await createWorkspaceFromPromptAction(session, prompt);
        // Route to test-ai-chat instead of workspace
        router.replace(`/test-ai-chat/${w.id}`);
      } catch (err) {
        logger.error("Failed to create workspace", { err });
        setIsPromptLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePromptSubmit();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Add size check (e.g., 100MB limit)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
      alert("File is too large. Maximum size is 100MB.");
      return;
    }

    if (!session) {
      alert("Please log in to upload");
      router.push('/login');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType || 'helm');

      const workspace = await createWorkspaceFromArchiveAction(session.id, formData, uploadType || 'helm');
      // Route to test-ai-chat instead of workspace
      router.replace(`/test-ai-chat/${workspace.id}`);
    } catch (error) {
      console.error('Error uploading:', error);
      alert("Failed to upload");
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploadType(null);
    }
  };

  const triggerFileUpload = (type: 'helm' | 'k8s') => {
    if (!isUploading && !isPromptLoading) {
      setUploadType(type);
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className="min-h-screen bg-black text-white bg-cover bg-center bg-no-repeat flex flex-col"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1667372459510-55b5e2087cd0?auto=format&fit=crop&q=80&w=2072")',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative flex-1 flex flex-col">
        <HomeNav />
        <main className="container mx-auto px-6 pt-12 sm:pt-20 lg:pt-32">
          {/* Header - same as main page */}
          <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-10 lg:mb-16">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
              Welcome to ChartSmith
            </h1>
            <p className="text-gray-400 text-base sm:text-lg">
              Create, modify, and validate your Helm charts with AI assistance
            </p>
          </div>

          {/* Create Options - matching main page */}
          <div className="w-full max-w-4xl mx-auto px-4">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-800">
              <div className="p-4 sm:p-6 relative">
                <textarea
                  ref={textareaRef}
                  placeholder="Tell me about the application you want to create a Helm chart for"
                  value={prompt}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) {
                      setPrompt(e.target.value);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isPromptLoading}
                  className="w-full min-h-[80px] sm:min-h-[120px] bg-transparent text-white placeholder-gray-500 text-base sm:text-lg resize-none focus:outline-none disabled:opacity-50"
                  maxLength={MAX_CHARS}
                />

                {isApproachingLimit && (
                  <div className="flex items-center mt-2 text-xs text-amber-500/90">
                    <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                    <span>ChartSmith works best with clear, concise prompts. Start simple and refine through conversation.</span>
                  </div>
                )}

                {prompt.trim() && (
                  <button
                    onClick={handlePromptSubmit}
                    disabled={isPromptLoading}
                    className="absolute top-3 sm:top-4 right-3 sm:right-4 p-1.5 sm:p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-md transition-colors"
                  >
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                {isPromptLoading && (
                  <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2 justify-center">
              <button
                onClick={() => triggerFileUpload('helm')}
                disabled={isUploading || isPromptLoading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
              >
                <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Upload a Helm chart
              </button>
              <button
                onClick={() => triggerFileUpload('k8s')}
                disabled={isUploading || isPromptLoading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
              >
                <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Upload Kubernetes manifests
              </button>
              <button
                onClick={() => setShowArtifactHubSearch(true)}
                disabled={isUploading || isPromptLoading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
              >
                <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Start from a chart in Artifact Hub
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept=".tgz,.tar.gz,.tar" className="hidden" onChange={handleFileUpload} />
            <ArtifactHubSearchModal
              isOpen={showArtifactHubSearch}
              onClose={() => setShowArtifactHubSearch(false)}
              targetPath="/test-ai-chat"
            />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
