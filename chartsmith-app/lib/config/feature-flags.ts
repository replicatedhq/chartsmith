/**
 * Feature Flags
 *
 * Centralized feature flag management for gradual rollout and rollback capability.
 */

/**
 * Feature flags configuration
 */
export const FEATURES = {
  /**
   * Use Vercel AI SDK for chat streaming
   * When false, falls back to the Go worker + Centrifugo implementation
   */
  USE_VERCEL_AI_SDK: process.env.NEXT_PUBLIC_USE_VERCEL_AI_SDK === "true",

  /**
   * Use Vercel AI SDK for intent classification
   * When false, uses the direct Anthropic SDK implementation
   */
  USE_VERCEL_AI_SDK_INTENT: process.env.USE_VERCEL_AI_SDK_INTENT !== "false",
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof typeof FEATURES
): boolean {
  return FEATURES[feature];
}

/**
 * Get all feature flags as a record (useful for debugging)
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  return { ...FEATURES };
}
