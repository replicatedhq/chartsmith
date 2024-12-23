import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface App {
  id: string;
  name: string;
  description: string;
}

interface AppSelectorProps {
  onSelect: (app: App) => void;
}

export function AppSelector({ onSelect }: AppSelectorProps) {
  const { theme } = useTheme();
  const [apps] = React.useState<App[]>([
    { id: '1', name: 'SlackerNews', description: 'A modern news aggregator' },
    { id: '2', name: 'Other App', description: 'Another great application' },
  ]);

  return (
    <div className="space-y-4">
      <h2 className={`text-xl font-semibold ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>
        Select Application
      </h2>
      <div className="grid gap-4">
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => onSelect(app)}
            className={`p-4 rounded-lg border text-left transition-colors ${
              theme === 'dark'
                ? 'border-dark-border hover:border-primary/50 bg-dark-surface'
                : 'border-gray-200 hover:border-primary/50 bg-white'
            }`}
          >
            <h3 className={`font-medium mb-1 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {app.name}
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {app.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}