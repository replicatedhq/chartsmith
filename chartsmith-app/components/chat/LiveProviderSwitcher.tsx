"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Bot, Cpu } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import {
  AVAILABLE_PROVIDERS,
  AVAILABLE_MODELS,
  getModelsForProvider,
  getModelById,
  type Provider,
} from "@/lib/ai/models";

interface LiveProviderSwitcherProps {
  currentProvider: string;
  currentModel: string;
  onSwitch: (provider: string, model: string) => void;
  disabled?: boolean;
}

/**
 * Live provider/model switcher component that allows switching AI models
 * during a conversation without losing context.
 */
export function LiveProviderSwitcher({
  currentProvider,
  currentModel,
  onSwitch,
  disabled = false,
}: LiveProviderSwitcherProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current model display info
  const modelConfig = getModelById(currentModel);
  const displayName = modelConfig?.name || currentModel.split("/").pop() || "Unknown";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (provider: string, model: string) => {
    onSwitch(provider, model);
    setIsOpen(false);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "anthropic":
        return <Bot className="w-4 h-4" />;
      case "openai":
        return <Cpu className="w-4 h-4" />;
      default:
        return <Cpu className="w-4 h-4" />;
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 p-1.5 rounded-full text-xs ${
          disabled
            ? theme === "dark"
              ? "text-gray-600 cursor-not-allowed"
              : "text-gray-300 cursor-not-allowed"
            : theme === "dark"
            ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        }`}
        title={`Model: ${displayName}${disabled ? " (switching disabled during streaming)" : ""}`}
      >
        {getProviderIcon(currentProvider)}
        <span className="max-w-[100px] truncate">{displayName}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 bottom-full mb-1 w-56 rounded-lg shadow-lg border py-1 z-50 ${
            theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
          }`}
        >
          {AVAILABLE_PROVIDERS.map((provider) => {
            const models = getModelsForProvider(provider.id);
            return (
              <div key={provider.id}>
                {/* Provider header */}
                <div
                  className={`px-3 py-1.5 text-xs font-medium ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {getProviderIcon(provider.id)}
                    {provider.name}
                  </div>
                </div>

                {/* Models for this provider */}
                {models.map((model) => {
                  const isSelected = currentModel === model.modelId;
                  return (
                    <button
                      key={model.modelId}
                      type="button"
                      onClick={() => handleSelect(provider.id, model.modelId)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                        isSelected
                          ? theme === "dark"
                            ? "bg-dark-border/60 text-white"
                            : "bg-gray-100 text-gray-900"
                          : theme === "dark"
                          ? "text-gray-300 hover:bg-dark-border/40 hover:text-white"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <Check
                        className={`w-4 h-4 flex-shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{model.name}</div>
                        <div
                          className={`text-xs truncate ${
                            theme === "dark" ? "text-gray-500" : "text-gray-400"
                          }`}
                        >
                          {model.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
