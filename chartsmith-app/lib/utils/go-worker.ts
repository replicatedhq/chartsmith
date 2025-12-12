/**
 * Go Worker URL utilities
 *
 * Provides functions to get the Go worker URL for API proxying.
 * Used by API routes that need to communicate with the Go backend.
 */

/**
 * Gets the Go worker URL from environment variable, database param, or defaults to localhost.
 *
 * Priority order:
 * 1. GO_WORKER_URL environment variable
 * 2. Database parameter (if available)
 * 3. http://localhost:8080 (local development default)
 *
 * @returns Go worker URL string
 */
export async function getGoWorkerUrl(): Promise<string> {
  // Try environment variable first (highest priority)
  if (process.env.GO_WORKER_URL) {
    return process.env.GO_WORKER_URL;
  }

  // Fall back to database param (if helper exists)
  try {
    const { getParam } = await import('@/lib/data/param');
    const paramUrl = await getParam('GO_WORKER_URL');
    if (paramUrl) {
      return paramUrl;
    }
  } catch {
    // Ignore if param helper doesn't exist or fails
  }

  // Default for local development
  return 'http://localhost:8080';
}
