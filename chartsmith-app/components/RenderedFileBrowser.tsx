"use client";

import React, { useState } from "react";
import { FileText, ChevronRight, ChevronDown } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { WorkspaceFile, Chart, RenderUpdate } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";

interface RenderedFileBrowserProps {
  charts: Chart[];
  onFileSelect: (file: WorkspaceFile) => void;
  selectedFile?: WorkspaceFile;
  renderUpdates?: RenderUpdate[];
  onRenderSelect?: (chart: Chart, type: 'stdout' | 'stderr' | 'manifests') => void;
}

export function RenderedFileBrowser({ charts, onFileSelect, selectedFile, renderUpdates, onRenderSelect }: RenderedFileBrowserProps) {
  const { theme } = useTheme();
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleChart = (chartId: string) => {
    const newExpanded = new Set(expandedCharts);
    if (newExpanded.has(chartId)) {
      newExpanded.delete(chartId);
    } else {
      newExpanded.add(chartId);
    }
    setExpandedCharts(newExpanded);
  };

  const toggleItem = (itemKey: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemKey)) {
      newExpanded.delete(itemKey);
    } else {
      newExpanded.add(itemKey);
    }
    setExpandedItems(newExpanded);
  };

  const handleSelect = (chart: Chart, type: 'stdout' | 'stderr' | 'manifests') => {
    if (onRenderSelect) {
      onRenderSelect(chart, type);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-2">
      {charts.map((chart) => {
        if (!chart.id) {
          logger.warn("Rendered chart missing ID", { chart });
          return null;
        }

        return (
          <div key={chart.id}>
            <div
              className={`flex items-center py-1 px-2 cursor-pointer rounded-sm group ${
                theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              }`}
              onClick={() => toggleChart(chart.id)}
            >
              <span className="w-4 h-4 mr-1">
                {expandedCharts.has(chart.id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
              <div className={`w-4 h-4 mr-2 ${theme === "dark" ? "text-white" : "text-[#0F1689]"}`}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm0 3c.68 0 1.34.068 1.982.191L13.4 4.74c-.46-.064-.927-.1-1.4-.1-.474 0-.94.036-1.4.1l-.582-1.55C10.66 3.069 11.32 3 12 3zm-6 9c0-1.293.416-2.49 1.121-3.467l1.046 1.046c-.11.293-.167.61-.167.942 0 .332.057.65.167.942l-1.046 1.046A5.972 5.972 0 016 12zm6 6c-1.293 0-2.49-.416-3.467-1.121l1.046-1.046c.293.11.61.167.942.167.332 0 .65-.057.942-.167l1.046 1.046A5.972 5.972 0 0112 18zm0-3c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3zm6-3c0 1.293-.416 2.49-1.121 3.467l-1.046-1.046c.11-.293.167-.61.167-.942 0-.332-.057-.65-.167-.942l1.046-1.046A5.972 5.972 0 0118 12z" fill="currentColor"/>
                </svg>
              </div>
              <span className="text-xs">{chart.name}</span>
            </div>
            {expandedCharts.has(chart.id) && (
              <div>
                <div
                  className={`flex items-center py-1 px-2 pl-8 cursor-pointer rounded-sm group ${
                    theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                  onClick={() => toggleItem(`${chart.id}-values`)}
                >
                  <span className="w-4 h-4 mr-1">
                    {expandedItems.has(`${chart.id}-values`) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                  <FileText className={`w-4 h-4 mr-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`} />
                  <span className="text-xs">Default values.yaml</span>
                </div>
                {expandedItems.has(`${chart.id}-values`) && (
                  <div className="pl-16">
                    <div
                      className={`py-1 px-2 cursor-pointer rounded-sm group ${
                        theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                      onClick={() => handleSelect(chart, 'stdout')}
                    >
                      <span className="text-xs">Stdout</span>
                    </div>
                    <div
                      className={`py-1 px-2 cursor-pointer rounded-sm group ${
                        theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                      onClick={() => handleSelect(chart, 'stderr')}
                    >
                      <span className="text-xs">Stderr</span>
                    </div>
                    <div
                      className={`py-1 px-2 cursor-pointer rounded-sm group ${
                        theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                      onClick={() => handleSelect(chart, 'manifests')}
                    >
                      <span className="text-xs">Rendered Manifests</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
