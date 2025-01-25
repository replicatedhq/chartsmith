"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  className?: string;
  label?: string;
}

export function PromptInput({ onSubmit, isLoading, className, label }: PromptInputProps) {
  const { theme } = useTheme();
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus the textarea when component mounts
    textareaRef.current?.focus();
  }, []);

  // Don't reset the prompt - it will be cleared when component unmounts during navigation

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isLoading) {
        onSubmit(prompt.trim());
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{label || "Describe Your Application"}</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Describe the Helm chart you want to create..."
            className={`w-full px-4 py-3 rounded-lg border resize-none h-32 ${
              theme === "dark" ? "bg-surface border-dark-border text-gray-300 placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 ${className || ""}`}
          />
          <button type="submit" disabled={!prompt.trim() || isLoading} className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${prompt.trim() && !isLoading ? "text-primary hover:bg-primary/10" : theme === "dark" ? "text-gray-600" : "text-gray-400"}`}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Press Enter to submit, Shift + Enter for new line</p>
      </div>
    </form>
  );
}
