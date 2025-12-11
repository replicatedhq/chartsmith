"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Download, Link, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { PromptModal } from "./PromptModal";
import { createWorkspaceFromArchiveAction } from "@/lib/workspace/actions/create-workspace-from-archive";
import { useSession } from "@/app/hooks/useSession";
import { createWorkspaceFromPromptAction } from "@/lib/workspace/actions/create-workspace-from-prompt";
import { logger } from "@/lib/utils/logger";
import { ArtifactHubSearchModal } from "./ArtifactHubSearchModal";

const MAX_CHARS = 512;
const WARNING_THRESHOLD = 500;

export function CreateChartOptions() {
  const [prompt, setPrompt] = useState('');
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const setShowReplicatedModal = useState(false)[1];
  const [showPromptModal, setShowPromptModal] = useState(false);
  const { session, isLoading: isSessionLoading } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [showArtifactHubSearch, setShowArtifactHubSearch] = useState(false);
  const [uploadType, setUploadType] = useState<'helm' | 'k8s' | null>(null);
  const [isApproachingLimit, setIsApproachingLimit] = useState(false);

  useEffect(() => {
    // Focus the textarea on mount
    textareaRef.current?.focus();
  }, []);
  
  // Check if input is approaching character limit
  useEffect(() => {
    setIsApproachingLimit(prompt.length >= WARNING_THRESHOLD);
  }, [prompt]);

  const handlePromptSubmit = async () => {
    logger.info("handlePromptSubmit called", { 
      isSessionLoading,
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      promptLength: prompt.length,
      promptTrimmed: prompt.trim().length
    });

    // Wait for session to finish loading before checking
    if (isSessionLoading) {
      logger.debug('Session still loading, waiting...');
      return;
    }

    // In test mode, allow submission even if session object isn't loaded yet
    // The server action will get session from cookies
    const isTestMode = process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true';
    
    if (!session && !isTestMode) {
      sessionStorage.setItem('pendingPrompt', prompt.trim());
      // Check if test auth is enabled via API config
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const config = await configRes.json();
          if (config.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true') {
            router.push('/login?test-auth=true');
            return;
          }
        }
      } catch (err) {
        logger.error('Failed to check test auth config', { error: err });
      }
      router.push('/login');
      return;
    }

    if (prompt.trim()) {
      try {
        setIsPromptLoading(true);
        logger.info("Calling createWorkspaceFromPromptAction", { 
          sessionUserId: session?.user?.id,
          promptLength: prompt.length,
          isTestMode,
          hasSessionCookie: typeof document !== 'undefined' && document.cookie.includes('session=')
        });
        // Pass only the prompt - session will be retrieved from cookies/server
        const w = await createWorkspaceFromPromptAction(prompt);
        logger.info("Workspace created successfully", { workspaceId: w.id });
        router.replace(`/workspace/${w.id}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        logger.error("Failed to create workspace", { 
          err, 
          errorMessage,
          errorStack,
          sessionUserId: session?.user?.id,
          promptLength: prompt.length
        });
        
        // Show error to user
        alert(`Failed to create workspace: ${errorMessage}`);
        
        setIsPromptLoading(false);
        // Re-throw so it's visible in tests
        throw err;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
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
      formData.append('type', uploadType || 'helm'); // Send the upload type to the backend

      const workspace = await createWorkspaceFromArchiveAction(session.id, formData, uploadType || 'helm');
      router.replace(`/workspace/${workspace.id}`);
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
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-800">
        <div className="p-4 sm:p-6 relative">
          <textarea
            ref={textareaRef}
            placeholder="Tell me about the application you want to create a Helm chart for"
            value={prompt}
            onChange={(e) => {
              // Prevent input beyond the character limit
              if (e.target.value.length <= MAX_CHARS) {
                setPrompt(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            onKeyPress={(e) => {
              // Prevent form submission on Enter
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
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
        {/* Icons under prompt box commented out
        <div className="border-t border-gray-800 p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => triggerFileUpload('helm')}
            disabled={isUploading || isPromptLoading}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Link className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => triggerFileUpload('k8s')}
            disabled={isUploading || isPromptLoading}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Link className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-300 transition-colors">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        */}
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
      <PromptModal isOpen={showPromptModal} onClose={() => setShowPromptModal(false)} />
      <ArtifactHubSearchModal
        isOpen={showArtifactHubSearch}
        onClose={() => setShowArtifactHubSearch(false)}
      />
    </div>
  );
}
