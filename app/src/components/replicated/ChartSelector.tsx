import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ArrowLeft } from 'lucide-react';

interface Chart {
  id: string;
  name: string;
  version: string;
}

interface ChartSelectorProps {
  appName: string;
  onBack: () => void;
  onSelect: (chart: Chart) => void;
}

export function ChartSelector({ appName, onBack, onSelect }: ChartSelectorProps) {
  const { theme } = useTheme();
  const [charts] = React.useState<Chart[]>([
    { id: '1', name: 'nginx-chart', version: '1.0.0' },
    { id: '2', name: 'redis-ha', version: '2.0.0' },
    { id: '3', name: 'mongodb-cluster', version: '1.2.0' },
  ]);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className={`flex items-center gap-2 ${
          theme === 'dark'
            ? 'text-gray-400 hover:text-white'
            : 'text-gray-600 hover:text-gray-900'
        } transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Apps
      </button>

      <h2 className={`text-xl font-semibold ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>
        Select Chart from {appName}
      </h2>

      <div className="grid gap-4">
        {charts.map((chart) => (
          <button
            key={chart.id}
            onClick={() => onSelect(chart)}
            className={`p-4 rounded-lg border text-left transition-colors ${
              theme === 'dark'
                ? 'border-dark-border hover:border-primary/50 bg-dark-surface'
                : 'border-gray-200 hover:border-primary/50 bg-white'
            }`}
          >
            <h3 className={`font-medium mb-1 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {chart.name}
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Version {chart.version}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}