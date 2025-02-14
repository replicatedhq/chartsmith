"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Download, Link, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { PromptModal } from "./PromptModal";
import { createWorkspaceFromArchiveAction } from "@/lib/workspace/actions/create-workspace-from-archive";
import { useSession } from "@/app/hooks/useSession";
import { createWorkspaceFromPromptAction } from "@/lib/workspace/actions/create-workspace-from-prompt";
import { logger } from "@/lib/utils/logger";
import { ArtifactHubSearchModal } from "./ArtifactHubSearchModal";

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

  useEffect(() => {
    // Focus the textarea on mount
    textareaRef.current?.focus();
  }, []);

  const handlePromptSubmit = async () => {
    if (!session) return;

    if (prompt.trim()) {
      setIsPromptLoading(true);
      try {
        const w = await createWorkspaceFromPromptAction(session, prompt);
        router.push(`/workspace/${w.id}`);
      } catch (err) {
        logger.error("Failed to create workspace", { err });
        setIsPromptLoading(false); // Reset on error
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
    if (!session) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Add size check (e.g., 100MB limit)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
      alert("File is too large. Maximum size is 100MB.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const workspace = await createWorkspaceFromArchiveAction(session, formData);

      // Redirect to the new workspace
      router.push(`/workspace/${workspace.id}`);

    } catch (error) {
      console.error('Error uploading chart:', error);
      alert("Failed to upload chart");
      setIsUploading(false); // Only reset on error
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-800">
        <div className="p-6 relative">
          <textarea
            ref={textareaRef}
            placeholder="Tell me about the application you want to create a Helm chart for"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPromptLoading}
            className="w-full min-h-[120px] bg-transparent text-white placeholder-gray-500 text-lg resize-none focus:outline-none disabled:opacity-50"
          />
          {prompt.trim() && (
            <button
              onClick={handlePromptSubmit}
              disabled={isPromptLoading}
              className="absolute top-4 right-4 p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-md transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          {isPromptLoading && (
            <div className="absolute bottom-4 right-4">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          )}
        </div>
        <div className="border-t border-gray-800 p-4 flex items-center gap-4">
          <button className="p-2 text-gray-400 hover:text-gray-300 transition-colors">
            <Link className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-300 transition-colors">
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => !isUploading && !isPromptLoading && fileInputRef.current?.click()}
          disabled={isUploading || isPromptLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload a chart
        </button>
        <button
          onClick={() => setShowArtifactHubSearch(true)}
          disabled={isUploading || isPromptLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
        >
          <Search className="w-3.5 h-3.5" />
          Start from a chart in Artifact Hub
        </button>
        <button
          onClick={() => setShowReplicatedModal(true)}
          disabled={isUploading || isPromptLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          Import a chart from Replicated
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".tgz,.tar.gz" className="hidden" onChange={handleFileUpload} />
      <PromptModal isOpen={showPromptModal} onClose={() => setShowPromptModal(false)} />
      <ArtifactHubSearchModal
        isOpen={showArtifactHubSearch}
        onClose={() => setShowArtifactHubSearch(false)}
      />
    </div>
  );
}
