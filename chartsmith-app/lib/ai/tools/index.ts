/**
 * AI SDK Tools Module
 * 
 * This module exports all AI SDK tools and the createTools factory function.
 * 
 * Tools available:
 * - getChartContext: Load workspace files and metadata (Go HTTP)
 * - textEditor: View, create, and edit files (Go HTTP)
 * - latestSubchartVersion: Look up subchart versions from ArtifactHub (Go HTTP)
 * - latestKubernetesVersion: Get Kubernetes version info (Go HTTP)
 * - convertK8sToHelm: Convert K8s manifests to Helm chart (PR3.0)
 */

import { createGetChartContextTool } from './getChartContext';
import { createTextEditorTool } from './textEditor';
import { createLatestSubchartVersionTool } from './latestSubchartVersion';
import { createLatestKubernetesVersionTool } from './latestKubernetesVersion';
import { createConvertK8sTool } from './convertK8s';

// Re-export individual tool factories
export { createGetChartContextTool } from './getChartContext';
export { createTextEditorTool } from './textEditor';
export { createLatestSubchartVersionTool } from './latestSubchartVersion';
export { createLatestKubernetesVersionTool } from './latestKubernetesVersion';
export { createConvertK8sTool } from './convertK8s';

// Re-export utility functions
export { callGoEndpoint } from './utils';

// Re-export response types
export type { ChartContextResponse } from './getChartContext';
export type { TextEditorResponse } from './textEditor';
export type { SubchartVersionResponse } from './latestSubchartVersion';
export type { KubernetesVersionResponse } from './latestKubernetesVersion';

/**
 * Create all AI SDK tools with the provided context
 * 
 * This factory function creates all tools with the necessary context
 * (auth header, workspace ID, revision number) captured in closures.
 * 
 * @param authHeader - Authorization header from the incoming request
 * @param workspaceId - The current workspace ID
 * @param revisionNumber - The current revision number
 * @param chatMessageId - PR3.0: Optional chat message ID for conversion tool
 * @returns An object containing all configured tools
 */
export function createTools(
  authHeader: string | undefined,
  workspaceId: string,
  revisionNumber: number,
  chatMessageId?: string
) {
  const baseTools = {
    getChartContext: createGetChartContextTool(workspaceId, revisionNumber, authHeader || ''),
    textEditor: createTextEditorTool(authHeader, workspaceId, revisionNumber),
    latestSubchartVersion: createLatestSubchartVersionTool(authHeader),
    latestKubernetesVersion: createLatestKubernetesVersionTool(authHeader),
  };

  // PR3.0: Add conversion tool if chatMessageId is provided
  if (chatMessageId) {
    return {
      ...baseTools,
      convertK8sToHelm: createConvertK8sTool(authHeader, workspaceId, chatMessageId),
    };
  }

  return baseTools;
}

/**
 * Tool names enum for reference
 */
export const TOOL_NAMES = {
  GET_CHART_CONTEXT: 'getChartContext',
  TEXT_EDITOR: 'textEditor',
  LATEST_SUBCHART_VERSION: 'latestSubchartVersion',
  LATEST_KUBERNETES_VERSION: 'latestKubernetesVersion',
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];

