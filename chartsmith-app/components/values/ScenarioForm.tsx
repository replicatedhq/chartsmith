"use client";

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createScenarioAction } from '@/lib/workspace/actions/create-scenario';
import { useSession } from '@/app/hooks/useSession';
import { ScenarioEditor } from './ScenarioEditor';
import { useCommandMenu } from '@/contexts/CommandMenuContext';
import { Workspace } from '@/lib/types/workspace';

interface ScenarioFormProps {
  workspace: Workspace
  chartId: string;
}

export function ScenarioForm({ workspace, chartId }: ScenarioFormProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useSession();
  const { setIsCommandMenuOpen } = useCommandMenu();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState('');

  const chart = workspace.charts.find(chart => chart.id === chartId);
  if (!chart) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !values || !session) return;
    
    try {
      await createScenarioAction(session, workspace.id, chartId, name, description, values);
      router.push(`/workspace/${workspace.id}/values`);
    } catch (err) {
      console.error("Failed to create scenario:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-[calc(100vh-theme(spacing.14))]">
      <div className="max-w-6xl mx-auto w-full px-6 flex flex-col flex-1 pb-6">
        <div className="flex-none py-6 flex flex-col gap-4">
          <div className="flex items-center text-sm">
            <button 
              type="button"
              onClick={() => router.push(`/workspace/${workspace.id}`)}
              className={`hover:underline ${theme === "dark" ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              Workspace
            </button>
            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            <button 
              type="button"
              onClick={() => router.push(`/workspace/${workspace.id}/values`)}
              className={`hover:underline ${theme === "dark" ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              Scenarios
            </button>
            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            <span className={theme === "dark" ? "text-gray-400" : "text-gray-500"}>
              {chart.name}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <h1 className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              Create New Scenario
            </h1>
            <p className={`text-md ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Create a new values scenario to test different configurations for your Helm chart.
            </p>
          </div>
        </div>

        <div className={`flex-1 flex flex-col bg-[var(--surface)] border rounded-lg overflow-hidden ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <div className="flex-1 p-6 space-y-6 overflow-auto">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${theme === "dark" ? "bg-dark border-dark-border text-gray-300" : "bg-white border-gray-300 text-gray-900"}`}
                placeholder="e.g., Production Settings"
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${theme === "dark" ? "bg-dark border-dark-border text-gray-300" : "bg-white border-gray-300 text-gray-900"}`}
                placeholder="e.g., Configuration for production environment"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                Values
              </label>
              <div className="flex-1">
                <ScenarioEditor
                  value={values}
                  onChange={setValues}
                />
              </div>
            </div>
          </div>

          <div className="flex-none p-4 bg-[var(--background)] border-t border-dark-border">
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
