"use client"

import React, { useState, useEffect } from 'react';
import { TopNav } from '@/components/TopNav';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesTable } from '@/components/values/ValuesTable';
import { ViewValuesModal } from '@/components/values/ViewValuesModal';
import { CreateScenarioModal } from '@/components/values/CreateScenarioModal';
import { DeleteScenarioModal } from '@/components/values/DeleteScenarioModal';
import { Plus } from 'lucide-react';
import { Scenario } from '@/lib/types/workspace';
import { createScenarioAction } from '@/lib/workspace/actions/create-scenario';
import { listScenariosAction } from '@/lib/workspace/actions/list-scenarios';
import { getWorkspaceAction } from '@/lib/workspace/actions/get-workspace';
import { Workspace, Chart } from '@/lib/types/workspace';
import { useSession } from '@/app/hooks/useSession';


import { use } from 'react';

export default function ValuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { theme } = useTheme();
  const [workspace, setWorkspace] = useState<Workspace | undefined>();
  const [scenariosByChart, setScenariosByChart] = useState<Map<string, Scenario[]>>(new Map());
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<Scenario | null>(null);
  const { session } = useSession();

  // Load workspace and scenarios
  useEffect(() => {
    async function loadWorkspaceAndScenarios() {
      if (!session) return;
      try {
        // Load workspace
        const loadedWorkspace = await getWorkspaceAction(session, id);
        if (!loadedWorkspace) return;
        setWorkspace(loadedWorkspace);

        // Load scenarios for each chart
        const scenariosMap = new Map<string, Scenario[]>();
        for (const chart of loadedWorkspace.charts) {
          const loadedScenarios = await listScenariosAction(session, id, chart.id);
          scenariosMap.set(chart.id, loadedScenarios);
        }
        setScenariosByChart(scenariosMap);
      } catch (err) {
        console.error("Failed to load workspace and scenarios:", err);
      }
    }
    loadWorkspaceAndScenarios();
  }, [session, id]);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);

  const handleCreateScenario = async (newScenario: Scenario) => {
    try {
      if (!session) return;
      if (!selectedChart) return;
      const chartId = selectedChart.id;
      const scenario = await createScenarioAction(session, id, chartId, newScenario.name, newScenario.description, newScenario.values);
      setScenariosByChart(prev => {
        const newMap = new Map(prev);
        const chartScenarios = newMap.get(chartId) || [];
        newMap.set(chartId, [...chartScenarios, { ...scenario, enabled: true }]);
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
        // Type assertion since we've already checked chartId exists
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
      // Type assertion since we've already checked chartId exists
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
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
      <TopNav />
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
                    setSelectedChart(chart);
                    setShowCreateModal(true);
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

      <CreateScenarioModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateScenario}
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
