/**
 * Chat Module Exports
 *
 * Central export for all chat functionality.
 * Simplified after AI SDK migration - most logic now uses SDK directly.
 */

// Schema for API requests
export { chatRequestSchema } from "./schema";
export type { ChatRequest } from "./schema";

// Prompts
export {
  CHAT_SYSTEM_PROMPT,
  INTENT_CLASSIFICATION_PROMPT,
  CHAT_INSTRUCTIONS,
  buildSystemPrompt,
} from "./prompts/system";

// Tools - only the write_file tool is used by the API route
export { createWriteFileTool } from "./tools/write-file";
export type { WriteFileContext } from "./tools/write-file";
