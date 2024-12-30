import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesScenario } from '@/lib/types/workspace';

interface ValuesTableProps {
  scenarios: ValuesScenario[];
  onViewValues: (scenario: ValuesScenario) => void;
  onDeleteScenario: (scenario: ValuesScenario) => void;
  onToggleEnabled: (scenario: ValuesScenario) => void;
}

export function ValuesTable({ scenarios, onViewValues, onDeleteScenario, onToggleEnabled }: ValuesTableProps) {
  const { theme } = useTheme();

  return (
    <div className={`rounded-lg overflow-hidden border ${theme === 'dark' ? 'bg-dark-surface border-dark-border' : 'bg-white border-gray-200'}`}>
      <table className="w-full">
        <thead>
          <tr className={`border-b ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'}`}>
            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Name</th>
            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Description</th>
            <th className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
            <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Actions</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${theme === 'dark' ? 'divide-dark-border' : 'divide-gray-200'}`}>
          {scenarios.map((scenario) => (
            <tr key={scenario.id}>
              <td className={`px-6 py-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{scenario.name}</td>
              <td className={`px-6 py-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{scenario.description}</td>
              <td className="px-6 py-4 text-center">
                <button
                  onClick={() => onToggleEnabled(scenario)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    scenario.enabled
                      ? 'bg-primary/10 text-primary'
                      : `${theme === 'dark' ? 'bg-dark-border/40 text-gray-400' : 'bg-gray-100 text-gray-500'}`
                  }`}
                >
                  {scenario.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </td>
              <td className="px-6 py-4 text-right space-x-2">
                <button
                  onClick={() => onViewValues(scenario)}
                  className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                >
                  View Values
                </button>
                {scenario.id !== 'default' && (
                  <button
                    onClick={() => onDeleteScenario(scenario)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'bg-dark-border/40 hover:bg-dark-border/60 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
