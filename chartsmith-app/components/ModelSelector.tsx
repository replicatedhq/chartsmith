'use client';

import { useState, useEffect } from 'react';
import { ModelInfo } from '@/lib/llm/registry';

interface ModelsResponse {
  providers: string[];
  recommended: ModelInfo[];
  all: ModelInfo[];
}

interface ModelSelectorProps {
  selectedModelId?: string;
  onModelChange: (modelId: string) => void;
  compact?: boolean;
}

export function ModelSelector({ selectedModelId, onModelChange, compact = false }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error('Failed to fetch models');
        }
        const data = await response.json();
        setModels(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models');
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <div className="animate-spin h-3 w-3 border border-gray-400 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400 rounded-full" />
        <span>Loading...</span>
      </div>
    );
  }

  if (error || !models) {
    return (
      <div className="text-xs text-red-500">
        {error || 'Failed to load'}
      </div>
    );
  }

  const displayModels = showAll ? models.all : models.recommended;
  
  // Get the default model if no selection (first model in the list)
  const defaultModelId = displayModels[0]?.id || '';
  const effectiveModelId = selectedModelId || defaultModelId;
  const currentModel = displayModels.find(m => m.id === effectiveModelId);

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="model-select" className="text-xs text-gray-500 dark:text-gray-400">
        Model:
      </label>
      
      <select
        id="model-select"
        value={effectiveModelId}
        onChange={(e) => onModelChange(e.target.value)}
        className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
      >
        {displayModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
}