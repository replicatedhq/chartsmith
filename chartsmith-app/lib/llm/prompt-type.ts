/**
 * Intent Classification
 *
 * Classifies user messages to determine intent using the same logic as the Go backend.
 * Uses Vercel AI SDK for provider-agnostic LLM calls.
 *
 * Matches: pkg/llm/intent.go
 */

import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat/prompts/system";

/**
 * Intent classification result - matches Go Intent struct
 */
export interface Intent {
  isConversational: boolean;
  isPlan: boolean;
  isOffTopic: boolean;
  isChartDeveloper: boolean;
  isChartOperator: boolean;
  isProceed: boolean;
  isRender: boolean;
}

/**
 * Persona types for message context
 */
export type MessageFromPersona = "auto" | "developer" | "operator";

/**
 * Zod schema for intent classification response
 */
const intentSchema = z.object({
  isConversational: z
    .boolean()
    .describe("true if the prompt is a question or request for information, false otherwise"),
  isPlan: z
    .boolean()
    .describe("true if the prompt is a request to perform an update to the chart templates or files, false otherwise"),
  isOffTopic: z
    .boolean()
    .describe("true if the prompt is off topic (not related to Helm charts or Kubernetes), false otherwise"),
  isChartDeveloper: z
    .boolean()
    .describe("true if the question is related to planning a change to the chart, false otherwise"),
  isChartOperator: z
    .boolean()
    .describe("true if the question is about how to use the Helm chart in a Kubernetes cluster, false otherwise"),
  isProceed: z
    .boolean()
    .describe("true if the prompt is a clear request to execute previous instructions with no requested changes, false otherwise"),
  isRender: z
    .boolean()
    .describe("true if the prompt is a request to render or test or validate the chart, false otherwise"),
});

/**
 * Build the intent classification prompt based on persona
 * Matches Go implementation in pkg/llm/intent.go
 */
function buildIntentPrompt(prompt: string, persona: MessageFromPersona | null): string {
  if (persona === null || persona === "auto") {
    return `${CHAT_SYSTEM_PROMPT}

Given this, the user's request is:

${prompt}

Determine if the prompt is a question, a request for information, or a request to perform an action.

Respond with a JSON object containing the following fields:
- isConversational: true if the prompt is a question or request for information, false otherwise
- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
- isOffTopic: true if the prompt is off topic, false otherwise
- isChartDeveloper: true if the question is related to planning a change to the chart, false otherwise
- isChartOperator: true if the question is about how to use the Helm chart in a Kubernetes cluster, false otherwise
- isProceed: true if the prompt is a clear request to execute previous instructions with no requested changes, false otherwise
- isRender: true if the prompt is a request to render or test or validate the chart, false otherwise`;
  } else if (persona === "developer") {
    return `${CHAT_SYSTEM_PROMPT}

Given this, the user's request is:

${prompt}

Determine if the prompt is a question, a request for information, or a request to perform an action.

Respond with a JSON object containing the following fields:
- isConversational: true if the prompt is a question or request for information, false otherwise
- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
- isOffTopic: true if the prompt is off topic, false otherwise
- isChartDeveloper: true if it's possible to answer this question as if it was asked by the chart developer, false if otherwise
- isProceed: true if the prompt is a clear request to execute previous instructions with no requested changes, false otherwise
- isRender: true if the prompt is a request to render or test or validate the chart, false otherwise`;
  } else if (persona === "operator") {
    return `${CHAT_SYSTEM_PROMPT}

Given this, the user's request is:

${prompt}

Determine if the prompt is a question, a request for information, or a request to perform an action.

Respond with a JSON object containing the following fields:
- isConversational: true if the prompt is a question or request for information, false otherwise
- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
- isOffTopic: true if the prompt is off topic, false otherwise
- isChartOperator: true if it's possible to answer this question as if it was asked by the chart operator and can be completed without making any changes to the chart templates or files, false if otherwise`;
  }

  return buildIntentPrompt(prompt, "auto");
}

/**
 * Get the LLM model for intent classification
 * Uses a fast model since this is just classification
 */
function getIntentModel() {
  const provider = process.env.CHAT_PROVIDER ?? "anthropic";

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY || "",
      });
      // Use GPT-4o-mini for fast classification
      return openai("gpt-4o-mini");
    }
    case "anthropic":
    default: {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || "",
      });
      // Use Haiku for fast classification
      return anthropic("claude-3-5-haiku-20241022");
    }
  }
}

/**
 * Classify a user message to determine intent
 *
 * @param prompt - The user's message to classify
 * @param isInitialPrompt - Whether this is the first message in a workspace
 * @param persona - The persona context (auto, developer, operator)
 * @returns Intent object with all classification flags
 */
export async function classifyIntent(
  prompt: string,
  isInitialPrompt: boolean = false,
  persona: MessageFromPersona | null = null
): Promise<Intent> {
  try {
    const model = getIntentModel();
    const intentPrompt = buildIntentPrompt(prompt, persona);

    const result = await generateObject({
      model,
      schema: intentSchema,
      prompt: intentPrompt,
    });

    let intent = result.object;

    // For initial prompts, we always assume it's a plan
    // (matching Go behavior in pkg/llm/intent.go line 134-137)
    if (isInitialPrompt) {
      intent = {
        ...intent,
        isPlan: true,
        isProceed: false,
      };
    }

    logger.info("Intent classification result", {
      prompt: prompt.substring(0, 100),
      intent,
    });

    return intent;
  } catch (err) {
    logger.error("Error classifying intent", { error: err });
    throw err;
  }
}

/**
 * Check if intent is ambiguous (all flags are false)
 * Matches Go behavior in pkg/listener/new_intent.go line 186
 */
export function isAmbiguousIntent(intent: Intent): boolean {
  return (
    !intent.isConversational &&
    !intent.isPlan &&
    !intent.isOffTopic &&
    !intent.isChartDeveloper &&
    !intent.isChartOperator &&
    !intent.isProceed &&
    !intent.isRender
  );
}

// Legacy exports for backwards compatibility
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
 * Legacy function - converts Intent to simple PromptType
 * @deprecated Use classifyIntent instead
 */
export async function promptType(message: string): Promise<PromptType> {
  const intent = await classifyIntent(message);
  return intent.isPlan ? PromptType.Plan : PromptType.Chat;
}
