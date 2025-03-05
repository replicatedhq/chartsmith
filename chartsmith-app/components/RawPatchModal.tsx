"use client";

import React, { useCallback, useEffect } from "react";
import { X, FileText } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface RawPatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  patchContent: string;
  fileName?: string;
}

export function RawPatchModal({ isOpen, onClose, patchContent, fileName }: RawPatchModalProps) {
  const { theme } = useTheme();

  const handleClose = useCallback(() => {
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
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-3xl rounded-lg shadow-lg border ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              Raw Patch {fileName && <span className="font-mono text-sm">({fileName})</span>}
            </h2>
          </div>
          <button onClick={handleClose} className={`${theme === "dark" ? "text-white hover:text-white/80" : "text-gray-500 hover:text-gray-700"} transition-colors`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <pre className={`p-4 rounded-md overflow-auto max-h-[70vh] text-sm font-mono whitespace-pre ${
            theme === "dark" ? "bg-dark-border/40 text-gray-300" : "bg-gray-100 text-gray-800"
          }`}>
            {patchContent || "No patch content available"}
          </pre>
        </div>
      </div>
    </div>
  );
}
