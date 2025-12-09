/**
 * Feature flag configuration for AI SDK migration.
 * 
 * Controls whether the new Vercel AI SDK chat implementation
 * is enabled or the legacy Centrifugo-based implementation is used.
 */

/**
 * Checks if AI SDK chat is enabled via environment variable.
 * 
 * @returns {boolean} True if AI SDK chat should be used, false otherwise
 * @default false - Defaults to legacy implementation for safety
 */
export function isAISDKChatEnabled(): boolean {
  // Read from environment variable, defaulting to false
  const flag = process.env.NEXT_PUBLIC_ENABLE_AI_SDK_CHAT;
  
  // Explicitly check for 'true' string to avoid truthy issues
  return flag === 'true';
}

