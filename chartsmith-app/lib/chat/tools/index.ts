/**
 * Tool System Exports
 *
 * Central module for accessing chat tools.
 * Provides both registry-based and direct tool access.
 */

import type { HttpClient } from "../providers/types";
import { defaultHttpClient } from "../providers/types";
import { ToolRegistry, createToolRegistry } from "./registry";
import {
  kubernetesVersionTool,
  kubernetesVersionToolFactory,
} from "./kubernetes-version";
import {
  createSubchartVersionTool,
  subchartVersionToolFactory,
} from "./subchart-version";

/**
 * Create a fully configured tool registry with all tools
 *
 * @param httpClient - Optional HTTP client for tool dependencies
 * @returns Configured ToolRegistry with all tools registered
 */
export function createConfiguredRegistry(
  httpClient: HttpClient = defaultHttpClient
): ToolRegistry {
  const registry = createToolRegistry({ httpClient });

  // Register all tools
  registry.register(kubernetesVersionToolFactory);
  registry.register(subchartVersionToolFactory);

  return registry;
}

/**
 * Get all tools as a record for direct use with AI SDK
 *
 * @param httpClient - Optional HTTP client for tool dependencies
 * @returns Record of tools compatible with streamText()
 */
export function getToolSet(
  httpClient: HttpClient = defaultHttpClient
): Record<string, unknown> {
  return {
    latest_kubernetes_version: kubernetesVersionTool,
    latest_subchart_version: createSubchartVersionTool(httpClient),
  };
}

/**
 * Default tool set using default HTTP client
 */
export const defaultToolSet = getToolSet();

// Re-export for individual access
export { ToolRegistry, createToolRegistry } from "./registry";
export type { ToolDefinition, ToolFactory, ToolDependencies } from "./registry";

export {
  kubernetesVersionTool,
  kubernetesVersionToolFactory,
  kubernetesVersionInputSchema,
  executeKubernetesVersion,
} from "./kubernetes-version";
export type { KubernetesVersionInput } from "./kubernetes-version";

export {
  createSubchartVersionTool,
  subchartVersionToolFactory,
  subchartVersionInputSchema,
  executeSubchartVersion,
} from "./subchart-version";
export type { SubchartVersionInput } from "./subchart-version";
