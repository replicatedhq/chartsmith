/**
 * Prompt Type Classification
 *
 * Classifies user messages to determine intent (plan vs chat).
 * Uses Vercel AI SDK for provider-agnostic implementation.
 */

import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { logger } from "@/lib/utils/logger";
import { INTENT_CLASSIFICATION_PROMPT } from "@/lib/chat/prompts/system";

export enum PromptType {
  Plan = "plan",
  Chat = "chat",
}

export enum PromptRole {
  Packager = "packager",
  User = "user",
}

export interface PromptIntent {
  intent: PromptType;
  role: PromptRole;
}

/**
 * Classify a user message to determine if it's a plan request or chat
 *
 * @param message - The user's message to classify
 * @returns PromptType.Plan or PromptType.Chat
 */
export async function promptType(message: string): Promise<PromptType> {
  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      maxOutputTokens: 1024,
      system: INTENT_CLASSIFICATION_PROMPT,
      messages: [{ role: "user", content: message }],
    });

    const text = result.text;

    if (text.toLowerCase().includes("plan")) {
      return PromptType.Plan;
    } else {
      return PromptType.Chat;
    }
  } catch (err) {
    logger.error("Error determining prompt type", err);
    throw err;
  }
}
