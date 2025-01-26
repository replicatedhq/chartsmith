"use client"

import React, { useState } from 'react';
import { TopNav } from '@/components/TopNav';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesTable } from '@/components/values/ValuesTable';
import { ViewValuesModal } from '@/components/values/ViewValuesModal';
import { CreateScenarioModal } from '@/components/values/CreateScenarioModal';
import { DeleteScenarioModal } from '@/components/values/DeleteScenarioModal';
import { Plus } from 'lucide-react';
import { ValuesScenario } from '@/lib/types/workspace';
import { createScenarioAction } from '@/lib/workspace/actions/create-scenario';
import { useSession } from '@/app/hooks/useSession';

const defaultScenario: ValuesScenario = {
  id: 'default',
  name: 'Default values.yaml',
  description: 'Default configuration values for the Helm chart',
  enabled: true,
  values: `# Default values for my-helm-chart
replicaCount: 1
image:
  repository: nginx
  tag: "1.16.0"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80`
};

import { use } from 'react';

export default function ValuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { theme } = useTheme();
  const [scenarios, setScenarios] = useState<ValuesScenario[]>([defaultScenario]);
  const [selectedScenario, setSelectedScenario] = useState<ValuesScenario | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<ValuesScenario | null>(null);
  const session = useSession();

  const handleCreateScenario = async (newScenario: ValuesScenario) => {
    try {
      const scenario = await createScenarioAction(session, id, newScenario.name, newScenario.values);
      setScenarios([...scenarios, { ...scenario, enabled: true }]);
    } catch (err) {
      console.error("Failed to create scenario:", err);
      // Here you might want to show an error toast or message to the user
    }
  };

  const handleDeleteScenario = (scenario: ValuesScenario) => {
    if (scenario.id === 'default') return;
    setScenarioToDelete(scenario);
  };

  const handleConfirmDelete = () => {
    if (scenarioToDelete) {
      setScenarios(scenarios.filter(s => s.id !== scenarioToDelete.id));
      setScenarioToDelete(null);
    }
  };

  const handleToggleEnabled = (scenario: ValuesScenario) => {
    if (scenario.id === 'default') return;
    setScenarios(scenarios.map(s =>
      s.id === scenario.id ? { ...s, enabled: !s.enabled } : s
    ));
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

          <div className="mb-6">
            <div className={`flex items-center justify-between py-2 border-b ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'}`}>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                Chart 1
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
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
          </div>

          <ValuesTable
            scenarios={scenarios}
            onViewValues={(scenario) => setSelectedScenario(scenario)}
            onDeleteScenario={handleDeleteScenario}
            onToggleEnabled={handleToggleEnabled}
          />
        </div>
      </div>

      <ViewValuesModal
        isOpen={!!selectedScenario}
        onClose={() => setSelectedScenario(null)}
        scenario={selectedScenario}
        onUpdate={(updatedScenario) => {
          setScenarios(scenarios.map(s =>
            s.id === updatedScenario.id ? updatedScenario : s
          ));
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
