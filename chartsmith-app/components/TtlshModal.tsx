"use client";

import React, { useState, useEffect } from "react";
import { X, Copy, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/app/hooks/useSession";
import { publishToTtlshAction } from "@/lib/workspace/actions/publish-to-ttlsh";
import { getPublishStatusAction, PublishStatus } from "@/lib/workspace/actions/get-publish-status";

interface TtlshModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TtlshModal({ isOpen, onClose }: TtlshModalProps) {
  const { theme } = useTheme();
  const { session } = useSession();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [statusPollingInterval, setStatusPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setIsPublishing(false);
      setIsPublished(false);
      setRepoUrl("");
      setError("");
      
      // Get current workspace ID from URL
      const path = window.location.pathname;
      const match = path.match(/\/workspace\/([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        setWorkspaceId(match[1]);
        checkExistingPublish(match[1]);
      }
    } else {
      // Clear polling interval when modal closes
      if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        setStatusPollingInterval(null);
      }
    }
  }, [isOpen]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
      }
    };
  }, [statusPollingInterval]);

  // Check if there's an existing publish for this workspace
  const checkExistingPublish = async (wsId: string) => {
    if (!session) return;
    
    try {
      const status = await getPublishStatusAction(session, wsId);
      
      if (status) {
        setPublishStatus(status);
        setRepoUrl(status.repoUrl);
        
        if (status.status === "completed") {
          setIsPublished(true);
        } else if (status.status === "pending" || status.status === "processing") {
          setIsPublishing(true);
          startStatusPolling(wsId);
        } else if (status.status === "failed") {
          setError(status.error || "Publishing failed");
        }
      }
    } catch (err) {
      console.error("Error checking publish status:", err);
    }
  };

  // Poll for status updates
  const startStatusPolling = (wsId: string) => {
    if (statusPollingInterval) {
      clearInterval(statusPollingInterval);
    }
    
    const interval = setInterval(async () => {
      if (!session) return;
      
      try {
        const status = await getPublishStatusAction(session, wsId);
        
        if (status) {
          setPublishStatus(status);
          
          if (status.status === "completed") {
            setIsPublished(true);
            setIsPublishing(false);
            clearInterval(interval);
            setStatusPollingInterval(null);
          } else if (status.status === "failed") {
            setIsPublishing(false);
            setError(status.error || "Publishing failed");
            clearInterval(interval);
            setStatusPollingInterval(null);
          }
        }
      } catch (err) {
        console.error("Error polling publish status:", err);
      }
    }, 2000); // Poll every 2 seconds
    
    setStatusPollingInterval(interval);
  };

  if (!isOpen) return null;

  const handlePublish = async () => {
    if (!session || !workspaceId) {
      setError("Unable to identify workspace or user session.");
      return;
    }

    setIsPublishing(true);
    setError("");

    try {
      const result = await publishToTtlshAction(session, workspaceId);
      
      if (result.success && result.repoUrl) {
        setRepoUrl(result.repoUrl);
        startStatusPolling(workspaceId);
      } else {
        setError(result.error || "Failed to publish. Please try again.");
        setIsPublishing(false);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Error publishing to ttl.sh:", err);
      setIsPublishing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-2xl rounded-lg shadow-lg border ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Push to ttl.sh OCI Registry</h2>
          <button onClick={onClose} className={`${theme === "dark" ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"} transition-colors`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className={theme === "dark" ? "text-gray-300" : "text-gray-600"}>
            Push your Helm chart to ttl.sh, a temporary and anonymous OCI registry for Helm charts.
            This is useful for testing and sharing. Charts will expire after 24 hours.
          </p>

          {!isPublished ? (
            <div className="space-y-4">
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                Click "Push" to publish your Helm chart to the ttl.sh OCI registry.
              </p>
              
              {error && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${theme === "dark" ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"}`}>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}
              
              {isPublishing && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${theme === "dark" ? "bg-amber-900/20 text-amber-400" : "bg-amber-50 text-amber-700"}`}>
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div>
                      <div className="font-medium">Publishing in progress...</div>
                      <div className="text-xs mt-1">This may take a few moments to complete</div>
                    </div>
                  </div>
                </div>
              )}
              
              {!isPublishing && (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || !workspaceId}
                  className={`w-full px-4 py-2 text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center`}
                >
                  Publish to OCI Registry
                </button>
              )}
              
              {!workspaceId && (
                <p className={`text-sm ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`}>
                  Please open this from a workspace page.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg flex items-start gap-2 ${theme === "dark" ? "bg-green-900/20 text-green-400" : "bg-green-50 text-green-600"}`}>
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Successfully published!</div>
                  <div className="text-xs mt-1">
                    Your chart "{publishStatus?.chartName || 'chart'}" v{publishStatus?.chartVersion || '0.1.0'} is now available
                  </div>
                </div>
              </div>
              
              <div className={`rounded-lg p-4 ${theme === "dark" ? "bg-dark/40" : "bg-gray-50"}`}>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Repository URL</h3>
                <div className="relative">
                  <pre className={`p-3 rounded-lg font-mono text-sm whitespace-normal break-all ${theme === "dark" ? "bg-dark text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                    {repoUrl}
                  </pre>
                  <button
                    onClick={() => handleCopy(repoUrl)}
                    className={`absolute top-2 right-2 p-1 rounded ${theme === "dark" ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"}`}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  To pull this Helm chart, use:
                </p>
                <div className="relative">
                  <pre className={`p-3 rounded-lg font-mono text-sm whitespace-normal break-all ${theme === "dark" ? "bg-dark text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                    {`helm pull oci://${repoUrl.replace(':latest', '')} --version ${publishStatus?.chartVersion || '0.1.0'}`}
                  </pre>
                  <button
                    onClick={() => handleCopy(`helm pull oci://${repoUrl.replace(':latest', '')} --version ${publishStatus?.chartVersion || '0.1.0'}`)}
                    className={`absolute top-2 right-2 p-1 rounded ${theme === "dark" ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"}`}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  To install this Helm chart directly, use:
                </p>
                <div className="relative">
                  <pre className={`p-3 rounded-lg font-mono text-sm whitespace-normal break-all ${theme === "dark" ? "bg-dark text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                    {`helm install my-release oci://${repoUrl.replace(':latest', '')} --version ${publishStatus?.chartVersion || '0.1.0'}`}
                  </pre>
                  <button
                    onClick={() => handleCopy(`helm install my-release oci://${repoUrl.replace(':latest', '')} --version ${publishStatus?.chartVersion || '0.1.0'}`)}
                    className={`absolute top-2 right-2 p-1 rounded ${theme === "dark" ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"}`}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                Note: This URL will expire in 24 hours. Make sure to use it before then.
              </p>
            </div>
          )}
        </div>
        <div className={`flex justify-end p-4 border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          {isPublished ? (
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 text-white bg-green-600 hover:bg-green-700"
              >
                Done
              </button>
            </div>
          ) : (
            <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60" : "text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200"}`}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}