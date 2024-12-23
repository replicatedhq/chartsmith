import React, { useState } from 'react';
import { X, Plus, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useValuesScenarios } from '../../contexts/ValuesScenariosContext';
import { CreateScenarioModal } from '../modals/CreateScenarioModal';

export function ValuesScenariosPanel() {
  const { theme } = useTheme();
  const { isOpen, scenarios, activeScenario, setActiveScenario } = useValuesScenarios();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className={`w-80 border-r flex flex-col ${
        theme === 'dark' 
          ? 'bg-dark-surface border-dark-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b flex items-center justify-between ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Values Scenarios
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-dark-border/40 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {scenarios.length === 0 ? (
            <div className={`text-center py-8 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <p>No scenarios created yet.</p>
              <p className="mt-2">
                Click the + button to create your first scenario.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => setActiveScenario(scenario)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    activeScenario?.id === scenario.id
                      ? 'bg-primary/10 text-primary'
                      : theme === 'dark'
                        ? 'text-gray-300 hover:bg-dark-border/40'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{scenario.name}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                  <p className={`text-sm mt-1 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {scenario.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateScenarioModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}