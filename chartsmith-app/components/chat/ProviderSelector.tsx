"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Cpu, Bot, Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  type Provider, 
  type ProviderConfig,
  AVAILABLE_PROVIDERS,
  getDefaultModelForProvider,
} from "@/lib/ai";

export interface ProviderSelectorProps {
  /** Currently selected provider */
  selectedProvider: Provider;
  /** Currently selected model ID */
  selectedModel: string;
  /** Callback when provider/model changes */
  onProviderChange: (provider: Provider, model: string) => void;
  /** Whether the selector is disabled (e.g., conversation has started) */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * ProviderSelector Component
 * 
 * Allows users to select which AI provider/model powers their chat.
 * This selector is shown at the start of a conversation and becomes
 * disabled once the first message is sent.
 * 
 * Per PR1 requirements:
 * - Provider selection locks after first message
 * - Users must start new conversation to switch providers
 */
export function ProviderSelector({
  selectedProvider,
  selectedModel,
  onProviderChange,
  disabled = false,
  className = "",
}: ProviderSelectorProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the current provider config
  const currentProviderConfig = AVAILABLE_PROVIDERS.find(
    (p) => p.id === selectedProvider
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle provider selection
  const handleSelectProvider = (provider: ProviderConfig) => {
    if (disabled) return;
    
    const defaultModel = getDefaultModelForProvider(provider.id);
    onProviderChange(provider.id, defaultModel);
    setIsOpen(false);
  };

  // Get icon for provider
  const getProviderIcon = (providerId: Provider) => {
    switch (providerId) {
      case "openai":
        return <Cpu className="w-4 h-4" />;
      case "anthropic":
        return <Bot className="w-4 h-4" />;
      default:
        return <Cpu className="w-4 h-4" />;
    }
  };

  // If disabled, show as a badge instead of dropdown
  if (disabled) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
          theme === "dark"
            ? "bg-dark-border/40 text-gray-400"
            : "bg-gray-100 text-gray-500"
        } ${className}`}
      >
        {getProviderIcon(selectedProvider)}
        <span>{currentProviderConfig?.name || selectedProvider}</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
          theme === "dark"
            ? "bg-dark border-dark-border/60 text-gray-200 hover:bg-dark-border/40 hover:border-dark-border"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        }`}
      >
        {getProviderIcon(selectedProvider)}
        <span>{currentProviderConfig?.name || selectedProvider}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 mt-1 w-64 rounded-lg shadow-lg border py-1 z-50 ${
            theme === "dark"
              ? "bg-dark-surface border-dark-border"
              : "bg-white border-gray-200"
          }`}
        >
          <div
            className={`px-3 py-2 text-xs font-medium border-b ${
              theme === "dark"
                ? "text-gray-400 border-dark-border/50"
                : "text-gray-500 border-gray-100"
            }`}
          >
            Select AI Model
          </div>

          {AVAILABLE_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleSelectProvider(provider)}
              className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                selectedProvider === provider.id
                  ? theme === "dark"
                    ? "bg-dark-border/60 text-white"
                    : "bg-primary/5 text-gray-900"
                  : theme === "dark"
                    ? "text-gray-300 hover:bg-dark-border/40 hover:text-white"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-1.5 rounded ${
                    theme === "dark" ? "bg-dark-border/60" : "bg-gray-100"
                  }`}
                >
                  {getProviderIcon(provider.id)}
                </div>
                <div>
                  <div className="text-sm font-medium">{provider.name}</div>
                  <div
                    className={`text-xs ${
                      theme === "dark" ? "text-gray-500" : "text-gray-400"
                    }`}
                  >
                    {provider.description}
                  </div>
                </div>
              </div>

              {selectedProvider === provider.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProviderSelector;

