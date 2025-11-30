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

  // Group models by provider (extracted from model ID)
  const groupedModels = availableModels.reduce((acc, modelConfig) => {
    const providerName = modelConfig.id.split('/')[0];
    const displayProviderName = 
      providerName === 'anthropic' ? 'Anthropic' :
      providerName === 'openai' ? 'OpenAI' :
      providerName === 'google' ? 'Google' :
      providerName === 'x-ai' ? 'xAI' :
      providerName;
    
    if (!acc[displayProviderName]) {
      acc[displayProviderName] = [];
    }
    acc[displayProviderName].push(modelConfig);
    return acc;
  }, {} as Record<string, ModelConfig[]>);

  const providerOrder = ['Google', 'Anthropic', 'xAI', 'OpenAI'];
  const sortedProviders = providerOrder.filter(p => groupedModels[p]);

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
          className={`absolute bottom-full mb-1 left-0 min-w-[200px] max-h-[320px] overflow-y-auto rounded-lg border shadow-xl z-[100] ${
            theme === "dark"
              ? "bg-dark-surface border-dark-border"
              : "bg-white border-gray-200"
          }`}
        >
          {sortedProviders.map((providerName, providerIndex) => (
            <div key={providerName}>
              {/* Provider Header */}
              <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                providerIndex > 0 ? 'border-t' : ''
              } ${
                theme === "dark" 
                  ? "text-gray-500 border-dark-border/50" 
                  : "text-gray-400 border-gray-200"
              }`}>
                {providerName}
              </div>
              
              {/* Models for this provider */}
              {groupedModels[providerName].map((modelConfig) => (
                <button
                  key={modelConfig.id}
                  onClick={() => handleSelectModel(modelConfig.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    model === modelConfig.id
                      ? theme === "dark"
                        ? "bg-dark-hover"
                        : "bg-gray-100"
                      : theme === "dark"
                      ? "hover:bg-dark-hover"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${
                      theme === "dark" ? "text-dark-text" : "text-gray-900"
                    }`}>
                      {modelConfig.name}
                    </div>
                  </div>
                  {model === modelConfig.id && (
                    <div className="flex items-center">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        theme === "dark" ? "bg-blue-400" : "bg-blue-500"
                      }`} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

