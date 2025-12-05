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
import { ModelInfo } from "@/lib/llm/registry";

const MAX_CHARS = 512;
const WARNING_THRESHOLD = 500;

interface ModelsResponse {
  providers: string[];
  recommended: ModelInfo[];
  all: ModelInfo[];
}

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
  
  // Model selector state
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    // Focus the textarea on mount
    textareaRef.current?.focus();
  }, []);
  
  // Check if input is approaching character limit
  useEffect(() => {
    setIsApproachingLimit(prompt.length >= WARNING_THRESHOLD);
  }, [prompt]);

  // Fetch available models
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error('Failed to fetch models');
        }
        const data = await response.json();
        setModels(data);
        
        // Load saved model preference
        const savedModelId = localStorage.getItem('preferredModelId');
        if (savedModelId) {
          setSelectedModelId(savedModelId);
        }
      } catch (err) {
        console.error('Failed to load models:', err);
      } finally {
        setModelsLoading(false);
      }
    }

    fetchModels();
  }, []);

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    localStorage.setItem('preferredModelId', modelId);
  };

  const handlePromptSubmit = async () => {
    if (!session) {
      sessionStorage.setItem('pendingPrompt', prompt.trim());
      router.push('/login');
      return;
    }

    if (prompt.trim()) {
      try {
        setIsPromptLoading(true);
        const w = await createWorkspaceFromPromptAction(session, prompt, selectedModelId || undefined);
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

      const workspace = await createWorkspaceFromArchiveAction(session.user.id, formData, uploadType || 'helm');
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
            disabled={isPromptLoading}
            className="w-full min-h-[80px] sm:min-h-[120px] bg-transparent text-white placeholder-gray-500 text-base sm:text-lg resize-none focus:outline-none disabled:opacity-50 pb-8"
            maxLength={MAX_CHARS}
          />
          
          {/* Model selector in bottom left */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            {modelsLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="animate-spin h-3 w-3 border border-gray-600 border-t-gray-400 rounded-full" />
                <span>Loading models...</span>
              </div>
            ) : models ? (
              <>
                <label htmlFor="model-select-home" className="text-xs text-gray-400">
                  Model:
                </label>
                 <select
                   id="model-select-home"
                   value={selectedModelId || models.recommended[0]?.id || ''}
                   onChange={(e) => handleModelChange(e.target.value)}
                   className="text-xs bg-gray-800/60 text-gray-300 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                 >
                   {models.recommended.map((model) => (
                     <option key={model.id} value={model.id}>
                       {model.name}
                     </option>
                   ))}
                 </select>
              </>
            ) : null}
          </div>

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
