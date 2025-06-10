"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Copy, Download, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/app/hooks/useSession";
import { useAtom } from 'jotai';
import { workspaceAtom } from "@/atoms/workspace";
import JSZip from 'jszip';

interface ZipDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ZipDownloadModal({ isOpen, onClose }: ZipDownloadModalProps) {
  const { theme } = useTheme();
  const { session } = useSession();
  const [workspace] = useAtom(workspaceAtom);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setIsDownloading(false);
      setIsDownloaded(false);
      setError("");
      setDownloadUrl(null);
      
      // Set filename based on the workspace
      if (workspace) {
        setFilename(`${workspace.name || 'chart'}.zip`);
      }
    } else {
      // Clean up the download URL to avoid memory leaks
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }
    }
  }, [isOpen, workspace]);

  const handleDownload = async () => {
    if (!workspace) {
      setError("No workspace data available.");
      return;
    }

    setIsDownloading(true);
    setError("");

    try {
      // Create a new JSZip instance
      const zip = new JSZip();
      
      // Add all chart files to the zip
      workspace.charts.forEach(chart => {
        chart.files.forEach(file => {
          // Skip .git files
          if (!file.filePath.includes('.git/')) {
            zip.file(file.filePath, file.content);
          }
        });
      });
      
      // Add any loose files
      workspace.files.forEach(file => {
        // Skip .git files
        if (!file.filePath.includes('.git/')) {
          zip.file(file.filePath, file.content);
        }
      });
      
      // Generate the zip content
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Create a download URL
      const url = URL.createObjectURL(content);
      setDownloadUrl(url);
      setIsDownloaded(true);
      setIsDownloading(false);

      // Trigger automatic download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error creating zip file:", err);
      setError("Failed to create the zip file. Please try again.");
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-2xl rounded-lg shadow-lg border ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Download as Zip</h2>
          <button onClick={onClose} className={`${theme === "dark" ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"} transition-colors`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className={theme === "dark" ? "text-gray-300" : "text-gray-600"}>
            Download your Helm chart as a zip file. This is useful for sharing or working locally.
          </p>

          {!isDownloaded ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border ${
                    theme === "dark" 
                      ? "bg-dark border-dark-border text-gray-300" 
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                  placeholder="chart.zip"
                />
              </div>

              {error && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${theme === "dark" ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>{error}</div>
                </div>
              )}

              {isDownloading && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${theme === "dark" ? "bg-amber-900/20 text-amber-400" : "bg-amber-50 text-amber-700"}`}>
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div>
                      <div className="font-medium">Creating zip file...</div>
                      <div className="text-xs mt-1">This may take a few moments to complete</div>
                    </div>
                  </div>
                </div>
              )}

              {!isDownloading && (
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`w-full px-4 py-2 text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                  Download Zip
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg flex items-start gap-2 ${theme === "dark" ? "bg-green-900/20 text-green-400" : "bg-green-50 text-green-600"}`}>
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Downloaded successfully!</div>
                  <div className="text-xs mt-1">
                    Your chart has been downloaded as {filename}
                  </div>
                </div>
              </div>

              {downloadUrl && (
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className={`w-full px-4 py-2 text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                  Download Again
                </button>
              )}
            </div>
          )}
        </div>
        <div className={`flex justify-end p-4 border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          {isDownloaded ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 text-white bg-green-600 hover:bg-green-700"
            >
              Done
            </button>
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
