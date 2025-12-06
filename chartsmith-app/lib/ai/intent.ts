/**
 * PR3.0: Intent Classification Client
 *
 * Provides TypeScript client for the Go /api/intent/classify endpoint.
 * Used to pre-classify user messages before sending to AI SDK.
 */

import { callGoEndpoint } from "./tools/utils";

/**
 * Intent classification result from Go/Groq
 */
export interface Intent {
  isOffTopic: boolean;
  isPlan: boolean;
  isConversational: boolean;
  isChartDeveloper: boolean;
  isChartOperator: boolean;
  isProceed: boolean;
  isRender: boolean;
}

interface ClassifyIntentRequest {
  prompt: string;
  isInitialPrompt: boolean;
  messageFromPersona: string;
}

interface ClassifyIntentResponse {
  intent: Intent;
}

/**
 * Classifies user intent via Go/Groq endpoint
 *
 * @param authHeader - Authorization header to forward to Go backend
 * @param prompt - User message to classify
 * @param isInitialPrompt - Whether this is the first message in the workspace
 * @param persona - User persona (auto/developer/operator)
 * @returns Classified intent
 */
export async function classifyIntent(
  authHeader: string | undefined,
  prompt: string,
  isInitialPrompt: boolean,
  persona: string
): Promise<Intent> {
  const response = await callGoEndpoint<ClassifyIntentResponse>(
    "/api/intent/classify",
    {
      prompt,
      isInitialPrompt,
      messageFromPersona: persona,
    } as ClassifyIntentRequest,
    authHeader
  );

  return response.intent;
}

/**
 * Intent routing result
 * Determines how to handle a message based on classified intent
 */
export type IntentRoute =
  | { type: "off-topic" }
  | { type: "proceed" }
  | { type: "render" }
  | { type: "ai-sdk" }; // Default - let AI SDK handle

/**
 * Determines how to route based on classified intent
 *
 * Routing logic per PRD:
 * - IsProceed → create revision from existing plan
 * - IsOffTopic (+ not initial + has revision) → polite decline
 * - IsRender → trigger render
 * - All others → proceed to AI SDK
 *
 * @param intent - Classified intent from Groq
 * @param isInitialPrompt - Whether this is the first message
 * @param currentRevision - Current workspace revision number
 * @returns How to route the message
 */
export function routeFromIntent(
  intent: Intent,
  isInitialPrompt: boolean,
  currentRevision: number
): IntentRoute {
  // IsProceed - create revision from existing plan
  if (intent.isProceed) {
    return { type: "proceed" };
  }

  // IsOffTopic - polite decline (only if not initial message and has revision)
  if (intent.isOffTopic && !isInitialPrompt && currentRevision > 0) {
    return { type: "off-topic" };
  }

  // IsRender - trigger render
  if (intent.isRender) {
    return { type: "render" };
  }

  // Default - let AI SDK process (covers IsPlan, IsConversational, etc.)
  return { type: "ai-sdk" };
}

