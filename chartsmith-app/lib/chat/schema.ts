/**
 * Chat API Request Schema
 *
 * Exported for type inference - consumers use z.infer<typeof chatRequestSchema>
 * to get compile-time type safety. No separate tests needed for schema validation.
 */

import { z } from "zod";
import type { UIMessage } from "ai";

/**
 * Chat request schema with UIMessage type.
 * Using z.custom<UIMessage>() gives us type safety at compile time.
 */
export const chatRequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1, "Messages array is required"),
  workspaceId: z.string().min(1, "Workspace ID is required"),
});

/**
 * Inferred type from schema - use this instead of manually defining types.
 * TypeScript ensures any code using ChatRequest matches the schema.
 */
export type ChatRequest = z.infer<typeof chatRequestSchema>;
