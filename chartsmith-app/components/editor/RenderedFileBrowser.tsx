"use client";

import React, { useState } from "react";
import { FileText, ChevronRight, ChevronDown } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useValuesScenarios } from "@/app/contexts/ValuesScenariosContext";
import { Scenario } from '@/lib/types/workspace';
import { WorkspaceFile, RenderedChart } from "@/lib/types/workspace";

interface RenderedFileBrowserProps {
  charts: RenderedChart[];
  onFileSelect: (file: WorkspaceFile) => void;
  selectedFile?: WorkspaceFile;
}

export function RenderedFileBrowser({ charts, onFileSelect, selectedFile }: RenderedFileBrowserProps) {
  const { theme } = useTheme();
  const { scenarios } = useValuesScenarios();
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set(["default"]));

  const toggleScenario = (id: string) => {
    const newExpanded = new Set(expandedScenarios);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedScenarios(newExpanded);
  };

  return (
    <div className={`w-64 h-full border-r flex-shrink-0 flex flex-col ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className={`p-2 text-sm border-b ${theme === "dark" ? "text-gray-400 border-dark-border" : "text-gray-500 border-gray-200"}`}>RENDERED MANIFESTS</div>
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1">
          {[{ id: "default", name: "Default values.yaml", enabled: true }, ...scenarios]
            .filter((scenario) => ("enabled" in scenario ? scenario.enabled !== false : true))
            .map((scenario) => (
              <div key={scenario.id}>
                <button onClick={() => toggleScenario(scenario.id)} className={`w-full px-2 py-1.5 rounded-sm text-left flex items-center gap-2 transition-colors ${theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"}`}>
                  {expandedScenarios.has(scenario.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="text-sm font-medium">{scenario.name}</span>
                </button>

                {expandedScenarios.has(scenario.id) && (
                  <div className="ml-4 mt-1 space-y-1">

                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
