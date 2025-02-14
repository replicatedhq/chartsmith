"use client";

import React, { useState } from "react";
import { Sparkles, Upload, FileQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { PromptModal } from "./PromptModal";
import { createWorkspaceFromArchiveAction } from "@/lib/workspace/actions/create-workspace-from-archive";
import { useSession } from "@/app/hooks/useSession";
interface CreateOption {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
}

export function CreateChartOptions() {
  const { theme } = useTheme();
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const setShowReplicatedModal = useState(false)[1];
  const [showPromptModal, setShowPromptModal] = useState(false);
  const { session } = useSession();
  const [isUploading, setIsUploading] = useState(false);

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

  const options: CreateOption[] = [
    {
      icon: <Sparkles className="w-12 h-12" />,
      title: "Prompt to Start",
      description: "Describe your application and let AI generate a chart",
      action: () => setShowPromptModal(true),
    },
    {
      icon: <Upload className="w-12 h-12" />,
      title: "Upload Chart",
      description: "Upload an existing Helm chart",
      action: () => !isUploading && fileInputRef.current?.click(),
    },
    {
      icon: <FileQuestion className="w-12 h-12" />,
      title: "From Replicated",
      description: "Select from your Replicated charts",
      action: () => setShowReplicatedModal(true),
    },
  ];

  return (
    <>
      <div suppressHydrationWarning className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto px-4 mt-16">
        {options.map((option, index) => (
          <button key={index} onClick={option.action} className={`p-8 rounded-lg border transition-colors flex flex-col items-center text-center group ${theme === "dark" ? "border-dark-border hover:border-primary/50 bg-dark-surface" : "border-gray-200 hover:border-primary/50 bg-white"}`}>
            <div className={`mb-6 ${theme === "dark" ? "text-gray-400" : "text-gray-500"} group-hover:text-primary transition-colors`}>{option.icon}</div>
            <h3 className={`text-xl font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              {index === 1 && isUploading ? "Uploading..." : option.title}
            </h3>
            <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{option.description}</p>
          </button>
        ))}
        <input ref={fileInputRef} type="file" accept=".tgz,.tar.gz" className="hidden" onChange={handleFileUpload} />
      </div>

      <PromptModal isOpen={showPromptModal} onClose={() => setShowPromptModal(false)} />
    </>
  );
}
