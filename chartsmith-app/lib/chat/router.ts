import { promptType, PromptType } from '@/lib/llm/prompt-type';

export enum ChatMessageIntent {
  NON_PLAN = 'NON_PLAN',
  PLAN = 'PLAN',
}

export interface RouteDecision {
  useAISDK: boolean;
  intent: ChatMessageIntent;
}

export async function routeChatMessage(message: string): Promise<RouteDecision> {
  const useAISDK = process.env.NEXT_PUBLIC_USE_AI_SDK !== 'false';
  
  if (!useAISDK) {
    return {
      useAISDK: false,
      intent: ChatMessageIntent.PLAN,
    };
  }
  
  const type = await promptType(message);
  
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