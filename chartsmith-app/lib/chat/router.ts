import { PromptType } from '@/lib/llm/prompt-type';

export enum ChatMessageIntent {
  NON_PLAN = 'NON_PLAN',
  PLAN = 'PLAN',
}

export interface RouteDecision {
  useAISDK: boolean;
  intent: ChatMessageIntent;
}

/**
 * Call the server-side API to determine the prompt type
 * This is necessary because the prompt type detection uses LLM APIs
 * which require server-side environment variables
 */
async function getPromptType(message: string): Promise<PromptType> {
  const response = await fetch('/api/llm/prompt-type', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to determine prompt type');
  }
  
  const data = await response.json();
  return data.type as PromptType;
}

export async function routeChatMessage(message: string): Promise<RouteDecision> {
  const useAISDK = process.env.NEXT_PUBLIC_USE_AI_SDK !== 'false';
  
  if (!useAISDK) {
    return {
      useAISDK: false,
      intent: ChatMessageIntent.PLAN,
    };
  }
  
  const type = await getPromptType(message);
  
  if (type === PromptType.Chat) {
    return {
      useAISDK: true,
      intent: ChatMessageIntent.NON_PLAN,
    };
  } else {
    return {
      useAISDK: false,
      intent: ChatMessageIntent.PLAN,
    };
  }
}