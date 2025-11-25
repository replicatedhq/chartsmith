"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Download, Link, ArrowRight, Loader2, AlertCircle, Flame } from "lucide-react";
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
  const { session } = useSession();
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
    if (!session) {
      sessionStorage.setItem('pendingPrompt', prompt.trim());
      router.push('/login');
      return;
    }

    if (prompt.trim()) {
      try {
        setIsPromptLoading(true);
        const w = await createWorkspaceFromPromptAction(session, prompt);
        router.replace(`/workspace/${w.id}`);
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
      {/* Main prompt card with forge styling */}
      <div className="relative group">
        {/* Ember glow on focus/hover */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-forge-ember/20 via-forge-ember/10 to-forge-ember/20 rounded-forge-lg blur opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />

        <div className="relative bg-forge-charcoal/90 backdrop-blur-sm rounded-forge-lg border border-forge-iron/50 overflow-hidden">
          <div className="p-4 sm:p-6 relative">
            <textarea
              ref={textareaRef}
              placeholder="Describe your application and I'll forge a Helm chart for you..."
              value={prompt}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) {
                  setPrompt(e.target.value);
                }
              }}
              onKeyDown={handleKeyDown}
              disabled={isPromptLoading}
              className="w-full min-h-[80px] sm:min-h-[120px] bg-transparent text-stone-100 placeholder-forge-zinc text-base sm:text-lg resize-none focus:outline-none disabled:opacity-50 font-body"
              maxLength={MAX_CHARS}
            />

            {isApproachingLimit && (
              <div className="flex items-center mt-2 text-xs text-forge-ember-bright/90">
                <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                <span>ChartSmith works best with clear, concise prompts. Start simple and refine through conversation.</span>
              </div>
            )}

            {prompt.trim() && (
              <button
                onClick={handlePromptSubmit}
                disabled={isPromptLoading}
                className="
                  absolute top-3 sm:top-4 right-3 sm:right-4
                  p-2 sm:p-2.5 rounded-forge
                  bg-forge-ember text-white
                  hover:bg-forge-ember-bright hover:shadow-ember
                  disabled:bg-forge-ember/50 disabled:cursor-not-allowed
                  transition-all duration-200 active:scale-95
                "
              >
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            {isPromptLoading && (
              <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 flex items-center gap-2">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-forge-ember animate-pulse" />
                <span className="text-xs text-forge-ember font-medium">Heating up...</span>
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
      </div>

      {/* Action buttons with forge styling */}
      <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 justify-center">
        <button
          onClick={() => triggerFileUpload('helm')}
          disabled={isUploading || isPromptLoading}
          className="
            group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5
            text-xs sm:text-sm font-medium rounded-forge
            bg-forge-iron/40 backdrop-blur-sm border border-forge-zinc/30
            text-forge-silver hover:text-stone-100
            hover:bg-forge-iron/60 hover:border-forge-ember/30
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-forge-iron/40 disabled:hover:border-forge-zinc/30
          "
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-forge-ember group-hover:scale-110 transition-transform" />
          Upload Helm chart
        </button>
        <button
          onClick={() => triggerFileUpload('k8s')}
          disabled={isUploading || isPromptLoading}
          className="
            group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5
            text-xs sm:text-sm font-medium rounded-forge
            bg-forge-iron/40 backdrop-blur-sm border border-forge-zinc/30
            text-forge-silver hover:text-stone-100
            hover:bg-forge-iron/60 hover:border-forge-ember/30
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-forge-iron/40 disabled:hover:border-forge-zinc/30
          "
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-forge-ember group-hover:scale-110 transition-transform" />
          Upload K8s manifests
        </button>
        <button
          onClick={() => setShowArtifactHubSearch(true)}
          disabled={isUploading || isPromptLoading}
          className="
            group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5
            text-xs sm:text-sm font-medium rounded-forge
            bg-forge-iron/40 backdrop-blur-sm border border-forge-zinc/30
            text-forge-silver hover:text-stone-100
            hover:bg-forge-iron/60 hover:border-forge-ember/30
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-forge-iron/40 disabled:hover:border-forge-zinc/30
          "
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-forge-ember group-hover:scale-110 transition-transform" />
          Search Artifact Hub
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
