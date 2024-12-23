import React from 'react';
import { Key } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useReplicated } from '../../contexts/ReplicatedContext';

interface ReplicatedAuthProps {
  onAuthenticated: () => void;
}

export function ReplicatedAuth({ onAuthenticated }: ReplicatedAuthProps) {
  const { theme } = useTheme();
  const { setToken } = useReplicated();
  const [apiToken, setApiToken] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiToken.trim()) {
      setToken(apiToken.trim());
      onAuthenticated();
    }
  };

  return (
    <div className={`p-8 rounded-lg border ${
      theme === 'dark'
        ? 'bg-dark-surface border-dark-border'
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-3 rounded-lg ${
          theme === 'dark' ? 'bg-dark-border/40' : 'bg-gray-100'
        }`}>
          <Key className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className={`text-xl font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Connect to Replicated
          </h2>
          <p className={`${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Add your API token to access your Replicated charts
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            API Token
          </label>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Paste your Replicated API token"
            className={`w-full px-4 py-3 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
          />
          <p className={`mt-2 text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            You can find your API token in the Replicated vendor portal under Account Settings
          </p>
        </div>

        <button
          type="submit"
          disabled={!apiToken.trim()}
          className={`w-full px-4 py-3 rounded-lg text-white transition-colors ${
            apiToken.trim()
              ? 'bg-primary hover:bg-primary/90'
              : 'bg-gray-500 cursor-not-allowed'
          }`}
        >
          Connect to Replicated
        </button>
      </form>
    </div>
  );
}