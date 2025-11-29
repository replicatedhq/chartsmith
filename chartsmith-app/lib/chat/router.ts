import { promptType, PromptType } from '@/lib/llm/prompt-type';

export enum ChatMessageIntent {
  NON_PLAN = 'NON_PLAN',
  PLAN = 'PLAN',
}

export interface RouteDecision {
  useAISDK: boolean;
  intent: ChatMessageIntent;
}

/**
 * Determines whether to route a message to AI SDK or Go backend
 * 
 * Simple conversational chat → AI SDK (fast, no database overhead)
 * Complex operations (plans, conversions, renders) → Go backend (full workflow)
 * 
 * @param message - The user's message
 * @returns RouteDecision indicating which system should handle the message
 */
export async function routeChatMessage(message: string): Promise<RouteDecision> {
  // Feature flag to disable AI SDK routing (for rollback safety)
  const useAISDK = process.env.NEXT_PUBLIC_USE_AI_SDK !== 'false';
  
  if (!useAISDK) {
    // Legacy mode: route everything to Go backend
    return {
      useAISDK: false,
      intent: ChatMessageIntent.PLAN, // Will be determined by backend
    };
  }
  
  // Use existing intent detection
  const type = await promptType(message);
  
  if (type === PromptType.Chat) {
    // Simple conversational chat → AI SDK
    return {
      useAISDK: true,
      intent: ChatMessageIntent.NON_PLAN,
    };
  } else {
    // Plan, conversion, or other complex operation → Go backend
    return {
      useAISDK: false,
      intent: ChatMessageIntent.PLAN,
    };
  }
}