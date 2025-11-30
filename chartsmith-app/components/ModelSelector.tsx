"use client";
import React, { useState, useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { aiProviderAtom, aiModelAtom } from "@/atoms/ai-provider";
import { getModelsForProvider, getDefaultModelForProvider, ModelConfig } from "@/lib/ai/models";
import { ChevronDown, Cpu } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ModelSelector() {
  const { theme } = useTheme();
  const [provider] = useAtom(aiProviderAtom);
  const [model, setModel] = useAtom(aiModelAtom);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableModels = getModelsForProvider(provider);
  const currentModel = availableModels.find(m => m.id === model);

  // Update model when provider changes if current model is not available
  useEffect(() => {
    if (!currentModel || currentModel.provider !== provider) {
      const defaultModel = getDefaultModelForProvider(provider);
      setModel(defaultModel);
    }
  }, [provider, currentModel, setModel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectModel = (modelId: string) => {
    setModel(modelId);
    setIsOpen(false);
  };

  const formatContextWindow = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    return `${(tokens / 1000).toFixed(0)}K`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          theme === "dark"
            ? "bg-dark-surface border-dark-border hover:border-dark-border-hover text-dark-text"
            : "bg-white border-gray-300 hover:border-gray-400 text-gray-700"
        }`}
        title="Select AI Model"
      >
        <Cpu className="w-4 h-4" />
        <span className="text-sm font-medium">{currentModel?.name || 'Select Model'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1 left-0 min-w-[280px] max-h-[400px] overflow-y-auto rounded-lg border shadow-lg z-50 ${
            theme === "dark"
              ? "bg-dark-surface border-dark-border"
              : "bg-white border-gray-200"
          }`}
        >
          {availableModels.map((modelConfig: ModelConfig) => (
            <button
              key={modelConfig.id}
              onClick={() => handleSelectModel(modelConfig.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                model === modelConfig.id
                  ? theme === "dark"
                    ? "bg-dark-hover"
                    : "bg-gray-100"
                  : theme === "dark"
                  ? "hover:bg-dark-hover"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="mt-0.5">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  theme === "dark" ? "text-dark-text" : "text-gray-900"
                }`}>
                  {modelConfig.name}
                </div>
                <div className={`text-xs mt-0.5 ${
                  theme === "dark" ? "text-dark-text-secondary" : "text-gray-500"
                }`}>
                  {modelConfig.description}
                </div>
                <div className={`text-xs mt-1 font-mono ${
                  theme === "dark" ? "text-dark-text-secondary" : "text-gray-400"
                }`}>
                  {formatContextWindow(modelConfig.contextWindow)} tokens
                </div>
              </div>
              {model === modelConfig.id && (
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${
                    theme === "dark" ? "bg-blue-400" : "bg-blue-500"
                  }`} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

