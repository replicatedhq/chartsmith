"use client";

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesTable } from '@/components/values/ValuesTable';
import { ViewValuesModal } from '@/components/values/ViewValuesModal';
import { DeleteScenarioModal } from '@/components/values/DeleteScenarioModal';
import { Plus } from 'lucide-react';
import { Scenario, Workspace } from '@/lib/types/workspace';
import { useSession } from '@/app/hooks/useSession';
import { useRouter } from 'next/navigation';
import { createScenarioAction } from '@/lib/workspace/actions/create-scenario';

interface ValuesContentProps {
  workspace: Workspace;
  initialScenariosByChart: Map<string, Scenario[]>;
}

export function ValuesContent({ workspace, initialScenariosByChart }: ValuesContentProps) {
  const { theme } = useTheme();
  const [scenariosByChart, setScenariosByChart] = useState<Map<string, Scenario[]>>(initialScenariosByChart);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [scenarioToDelete, setScenarioToDelete] = useState<Scenario | null>(null);
  const { session } = useSession();
  const router = useRouter();

  const handleCreateScenario = async (newScenario: Scenario) => {
    try {
      if (!session) return;
      if (!newScenario.chartId) return;
      const scenario = await createScenarioAction(session, workspace.id, newScenario.chartId, newScenario.name, newScenario.description, newScenario.values);
      setScenariosByChart(prev => {
        const newMap = new Map(prev);
        const chartScenarios = newMap.get(newScenario.chartId!) || [];
        newMap.set(newScenario.chartId!, [...chartScenarios, { ...scenario, enabled: true }]);
        return newMap;
      });
    } catch (err) {
      console.error("Failed to create scenario:", err);
    }
  };

  const handleDeleteScenario = (scenario: Scenario) => {
    if (scenario.id === 'default') return;
    setScenarioToDelete(scenario);
  };

  const handleConfirmDelete = () => {
    if (scenarioToDelete?.chartId) {
      setScenariosByChart(prev => {
        const newMap = new Map(prev);
        const chartId = scenarioToDelete.chartId as string;
        const chartScenarios = newMap.get(chartId) || [];
        newMap.set(
          chartId,
          chartScenarios.filter(s => s.id !== scenarioToDelete.id)
        );
        return newMap;
      });
      setScenarioToDelete(null);
    }
  };

  const handleToggleEnabled = (scenario: Scenario) => {
    if (!scenario.chartId) return;
    setScenariosByChart(prev => {
      const newMap = new Map(prev);
      const chartId = scenario.chartId as string;
      const chartScenarios = newMap.get(chartId) || [];
      newMap.set(
        chartId,
        chartScenarios.map(s =>
          s.id === scenario.id ? { ...s, enabled: !s.enabled } : s
        )
      );
      return newMap;
    });
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 mb-6">
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Values Scenarios
          </h1>
          <p className={`text-md text-gray-500 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Values scenarios allow you to manage different configurations for your Helm chart.
            You can define additional values.yamls for each Helm chart in your workspace.
            Chartsmith will use these to validate each update of the chart.
          </p>
        </div>

        {workspace?.charts.map((chart) => (
          <div key={chart.id} className="mb-6">
            <div className={`flex items-center justify-between py-2 border-b ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'}`}>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                {chart.name}
              </h2>
              <button
                onClick={() => {
                  router.push(`/workspace/${workspace.id}/values/create-scenario?chartId=${chart.id}`);
                }}
                className={`px-3 py-1.5 text-sm border rounded-lg transition-colors flex items-center gap-2 ${
                  theme === 'dark'
                    ? 'border-dark-border hover:bg-dark-border/40 text-gray-300'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                Create Scenario
              </button>
            </div>

            <ValuesTable
              scenarios={scenariosByChart.get(chart.id) || []}
              onViewValues={(scenario) => setSelectedScenario(scenario)}
              onDeleteScenario={handleDeleteScenario}
              onToggleEnabled={handleToggleEnabled}
            />
          </div>
        ))}
      </div>

      <ViewValuesModal
        isOpen={!!selectedScenario}
        onClose={() => setSelectedScenario(null)}
        scenario={selectedScenario}
        onUpdate={(updatedScenario) => {
          if (!updatedScenario.chartId) return;
          setScenariosByChart(prev => {
            const newMap = new Map(prev);
            const chartId = updatedScenario.chartId as string;
            const chartScenarios = newMap.get(chartId) || [];
            newMap.set(
              chartId,
              chartScenarios.map(s =>
                s.id === updatedScenario.id ? updatedScenario : s
              )
            );
            return newMap;
          });
        }}
      />

      <DeleteScenarioModal
        isOpen={!!scenarioToDelete}
        onClose={() => setScenarioToDelete(null)}
        onConfirm={handleConfirmDelete}
        scenarioName={scenarioToDelete?.name || ''}
      />
    </div>
  );
}
