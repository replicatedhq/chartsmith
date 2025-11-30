import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// Provider types
export type AIProvider = 'anthropic' | 'openrouter';

// Provider atom - persisted to localStorage
export const aiProviderAtom = atomWithStorage<AIProvider>(
  'chartsmith-ai-provider',
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as AIProvider) || 'anthropic'
);

// Model atom - persisted to localStorage
export const aiModelAtom = atomWithStorage<string>(
  'chartsmith-ai-model',
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL) || 'claude-3-5-sonnet-20241022'
);

// Loading state for provider/model changes
export const aiProviderLoadingAtom = atom<boolean>(false);

