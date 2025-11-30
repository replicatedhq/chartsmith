"use client";
import React, { useState, useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { aiProviderAtom, AIProvider } from "@/atoms/ai-provider";
import { ChevronDown, Sparkles, Network } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface ProviderOption {
  value: AIProvider;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'anthropic',
    label: 'Anthropic',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Claude models by Anthropic'
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    icon: <Network className="w-4 h-4" />,
    description: 'Multi-model access via OpenRouter'
  },
];

export function ProviderSelector() {
  const { theme } = useTheme();
  const [provider, setProvider] = useAtom(aiProviderAtom);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentProvider = PROVIDER_OPTIONS.find(p => p.value === provider);

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

  const handleSelectProvider = (value: AIProvider) => {
    setProvider(value);
    setIsOpen(false);
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
        title="Select AI Provider"
      >
        {currentProvider?.icon}
        <span className="text-sm font-medium">{currentProvider?.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1 left-0 min-w-[200px] rounded-lg border shadow-lg z-50 ${
            theme === "dark"
              ? "bg-dark-surface border-dark-border"
              : "bg-white border-gray-200"
          }`}
        >
          {PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelectProvider(option.value)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                provider === option.value
                  ? theme === "dark"
                    ? "bg-dark-hover"
                    : "bg-gray-100"
                  : theme === "dark"
                  ? "hover:bg-dark-hover"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="mt-0.5">{option.icon}</div>
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  theme === "dark" ? "text-dark-text" : "text-gray-900"
                }`}>
                  {option.label}
                </div>
                <div className={`text-xs mt-0.5 ${
                  theme === "dark" ? "text-dark-text-secondary" : "text-gray-500"
                }`}>
                  {option.description}
                </div>
              </div>
              {provider === option.value && (
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

