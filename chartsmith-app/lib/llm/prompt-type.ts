/**
 * Prompt type classification using Vercel AI SDK.
 * 
 * Migrated from direct @anthropic-ai/sdk usage to @ai-sdk/anthropic
 * for unified LLM provider abstraction.
 */

import { generateText } from 'ai';
import { getModel } from './provider';
import { logger } from '@/lib/utils/logger';

export enum PromptType {
  Plan = 'plan',
  Chat = 'chat',
}

export enum PromptRole {
  Packager = 'packager',
  User = 'user',
}

export interface PromptIntent {
  intent: PromptType;
  role: PromptRole;
}

/**
 * Determines whether a user's message is asking for a plan/change
 * or just a conversational question.
 * 
 * Uses the configured LLM provider (defaults to Anthropic Claude).
 * 
 * @param message - The user's message to classify
 * @returns The classified prompt type (Plan or Chat)
 */
export async function promptType(message: string): Promise<PromptType> {
  try {
    const { text } = await generateText({
      model: getModel(),
      maxTokens: 1024,
      system: `You are ChartSmith, an expert at creating Helm charts for Kubernetes.
You are invited to participate in an existing conversation between a user and an expert.
The expert just provided a recommendation on how to plan the Helm chart to the user.
The user is about to ask a question.
You should decide if the user is asking for a change to the plan/chart, or if they are just asking a conversational question.
Be exceptionally brief and precise in your response.
Only say "plan" or "chat" in your response.
`,
      messages: [
        { role: 'user', content: message }
      ],
    });

    if (text.toLowerCase().includes('plan')) {
      return PromptType.Plan;
    } else {
      return PromptType.Chat;
    }
  } catch (err) {
    logger.error('Error determining prompt type', err);
    throw err;
  }
}
