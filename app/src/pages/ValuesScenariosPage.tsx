import React, { useState } from 'react';
import { TopNav } from '../components/layout/TopNav';
import { useTheme } from '../contexts/ThemeContext';
import { ValuesTable } from '../components/values/ValuesTable';
import { ViewValuesModal } from '../components/modals/ViewValuesModal';
import { CreateScenarioModal } from '../components/modals/CreateScenarioModal';
import { DeleteScenarioModal } from '../components/modals/DeleteScenarioModal';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}

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

export function ValuesScenariosPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<ValuesScenario[]>([defaultScenario]);
  const [selectedScenario, setSelectedScenario] = useState<ValuesScenario | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<ValuesScenario | null>(null);

  const handleCreateScenario = (newScenario: ValuesScenario) => {
    setScenarios([...scenarios, { ...newScenario, enabled: true }]);
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
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/editor')}
              className={`flex items-center gap-2 ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              } transition-colors`}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Editor
            </button>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Values Scenarios
            </h1>
          </div>

          <div className="flex justify-end mb-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Scenario
            </button>
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