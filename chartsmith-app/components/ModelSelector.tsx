'use client';

import { useState, useEffect, useRef } from 'react';
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
  const selectRef = useRef<HTMLSelectElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

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

  // Compute values needed for auto-sizing (before early returns to maintain hook order)
  const displayModels = models ? (showAll ? models.all : models.recommended) : [];
  const defaultModelId = displayModels[0]?.id || '';
  const effectiveModelId = selectedModelId || defaultModelId;
  const currentModel = displayModels.find(m => m.id === effectiveModelId);

  // Auto-size the select based on content - must be before conditional returns
  useEffect(() => {
    if (selectRef.current && measureRef.current && currentModel) {
      // Copy computed styles from select to measure span
      const selectStyles = window.getComputedStyle(selectRef.current);
      measureRef.current.style.fontSize = selectStyles.fontSize;
      measureRef.current.style.fontFamily = selectStyles.fontFamily;
      measureRef.current.style.fontWeight = selectStyles.fontWeight;
      measureRef.current.style.letterSpacing = selectStyles.letterSpacing;
      measureRef.current.textContent = currentModel.name;
      
      // Use requestAnimationFrame to ensure measurement happens after render
      requestAnimationFrame(() => {
        if (measureRef.current && selectRef.current) {
          const width = measureRef.current.offsetWidth;
          // Add padding for text (px-2 = 8px each side) and dropdown arrow (~20px)
          selectRef.current.style.width = `${width + 28}px`;
        }
      });
    }
  }, [currentModel, effectiveModelId]);

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

  return (
    <div className="flex items-center gap-1.5 relative">
      {/* Hidden span to measure text width */}
      <span
        ref={measureRef}
        className="text-xs invisible absolute whitespace-nowrap pointer-events-none"
        aria-hidden="true"
      />
      <select
        ref={selectRef}
        id="model-select"
        value={effectiveModelId}
        onChange={(e) => onModelChange(e.target.value)}
        className={`text-xs rounded px-2 py-0.5 pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 inline-block ${
          compact 
            ? "bg-transparent border-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" 
            : "bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
        }`}
        style={{ minWidth: '80px', width: 'auto' }}
      >
        {displayModels.map((model) => (
          <option key={model.id} value={model.id} className="bg-white dark:bg-dark-surface">
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
}