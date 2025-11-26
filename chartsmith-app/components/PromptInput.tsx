"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, Flame } from "lucide-react";

// contexts
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
        <label className={`
          block text-sm font-display font-medium mb-2
          ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}
        `}>
          {label || "Describe Your Application"}
        </label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Describe the Helm chart you want to forge..."
            className={`
              w-full px-4 py-3 rounded-forge border resize-none h-32 font-body
              ${theme === "dark"
                ? "bg-forge-charcoal border-forge-iron text-stone-100 placeholder-forge-zinc"
                : "bg-white border-stone-300 text-stone-900 placeholder-stone-400"
              }
              focus:outline-none focus:ring-2 focus:ring-forge-ember/50 focus:border-forge-ember/50
              disabled:opacity-50
              ${className || ""}
            `}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className={`
              absolute bottom-3 right-3 p-2 rounded-forge transition-all
              ${prompt.trim() && !isLoading
                ? "text-forge-ember hover:bg-forge-ember/10 hover:scale-105"
                : theme === "dark"
                  ? "text-forge-zinc"
                  : "text-stone-400"
              }
            `}
          >
            {isLoading ? (
              <Flame className="w-5 h-5 text-forge-ember animate-pulse" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className={`
          mt-2 text-xs
          ${theme === "dark" ? "text-forge-zinc" : "text-stone-500"}
        `}>
          Press Enter to submit, Shift + Enter for new line
        </p>
      </div>
    </form>
  );
}
