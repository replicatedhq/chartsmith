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
 * Feature flag to use new Vercel AI SDK implementation
 */
const USE_VERCEL_AI_SDK = process.env.USE_VERCEL_AI_SDK_INTENT !== "false";

/**
 * Classify a user message to determine if it's a plan request or chat
 *
 * @param message - The user's message to classify
 * @returns PromptType.Plan or PromptType.Chat
 */
export async function promptType(message: string): Promise<PromptType> {
  if (USE_VERCEL_AI_SDK) {
    return promptTypeWithVercelAiSdk(message);
  }
  return promptTypeWithAnthropicSdk(message);
}

/**
 * Implementation using Vercel AI SDK (new)
 */
async function promptTypeWithVercelAiSdk(message: string): Promise<PromptType> {
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
    logger.error("Error determining prompt type (Vercel AI SDK)", err);
    throw err;
  }
}

/**
 * Implementation using Anthropic SDK directly (legacy, for rollback)
 */
async function promptTypeWithAnthropicSdk(message: string): Promise<PromptType> {
  try {
    // Dynamic import to avoid loading if not needed
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: `You are ChartSmith, an expert at creating Helm charts for Kuberentes.
You are invited to participate in an existing conversation between a user and an expert.
The expert just provided a recommendation on how to plan the Helm chart to the user.
The user is about to ask a question.
You should decide if the user is asking for a change to the plan/chart, or if they are just asking a conversational question.
Be exceptionally brief and precise. in your response.
Only say "plan" or "chat" in your response.
`,
      messages: [{ role: "user", content: message }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";

    if (text.toLowerCase().includes("plan")) {
      return PromptType.Plan;
    } else {
      return PromptType.Chat;
    }
  } catch (err) {
    logger.error("Error determining prompt type (Anthropic SDK)", err);
    throw err;
  }
}
