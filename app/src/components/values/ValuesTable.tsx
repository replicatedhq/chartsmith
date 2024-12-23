import React from 'react';
import { Eye, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
  enabled?: boolean;
}

interface ValuesTableProps {
  scenarios: ValuesScenario[];
  onViewValues: (scenario: ValuesScenario) => void;
  onDeleteScenario: (scenario: ValuesScenario) => void;
  onToggleEnabled: (scenario: ValuesScenario) => void;
}

export function ValuesTable({ scenarios, onViewValues, onDeleteScenario, onToggleEnabled }: ValuesTableProps) {
  const { theme } = useTheme();

  return (
    <div className={`rounded-lg overflow-hidden border ${
      theme === 'dark'
        ? 'bg-dark-surface border-dark-border'
        : 'bg-white border-gray-200'
    }`}>
      <table className="w-full">
        <thead>
          <tr className={`border-b ${
            theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
          }`}>
            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Name
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Description
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Status
            </th>
            <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y ${
          theme === 'dark' ? 'divide-dark-border' : 'divide-gray-200'
        }`}>
          {scenarios.map((scenario) => (
            <tr key={scenario.id} className={
              theme === 'dark' 
                ? 'hover:bg-dark-border/20' 
                : 'hover:bg-gray-50'
            }>
              <td className={`px-6 py-4 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {scenario.name}
              </td>
              <td className={`px-6 py-4 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {scenario.description}
              </td>
              <td className={`px-6 py-4 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {scenario.id !== 'default' && (
                  <button
                    onClick={() => onToggleEnabled(scenario)}
                    className="flex items-center gap-2"
                  >
                    {scenario.enabled ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-primary" />
                        <span className="text-primary">Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                          Disabled
                        </span>
                      </>
                    )}
                  </button>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onViewValues(scenario)}
                    className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    View Values
                  </button>
                  {scenario.id !== 'default' && (
                    <button
                      onClick={() => onDeleteScenario(scenario)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                        theme === 'dark'
                          ? 'bg-dark-border/40 hover:bg-dark-border/60 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}