/**
 * Helm Tool Schemas for Vercel AI SDK
 *
 * This file defines all Chartsmith tools migrated from Go backend to TypeScript.
 * Each tool uses Zod for type-safe parameter validation and provides async execution.
 *
 * Tools Included:
 * 1. textEditorTool - Create, view, and edit Helm chart files
 * 2. latestSubchartVersionTool - Query latest Helm chart versions from ArtifactHub
 * 3. latestKubernetesVersionTool - Get current stable Kubernetes versions
 * 4. recommendedDependencyTool - AI-powered subchart recommendations (future)
 *
 * @see .taskmaster/docs/task-9-tool-schema-design.md for detailed documentation
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  fetchLatestSubchartVersion,
  searchArtifactHub,
} from './artifacthub';
import { getK8sVersionComponent } from './kubernetes';
import {
  viewFile,
  replaceTextInFile,
  createFile,
} from './text-editor-db';

// ============================================================================
// Tool Parameter Schemas
// ============================================================================

const textEditorSchema = z.object({
  command: z
    .enum(['view', 'str_replace', 'create'])
    .describe(
      'Operation to perform: "view" to read file, "str_replace" to find/replace text, "create" to make new file'
    ),

  path: z
    .string()
    .min(1)
    .describe(
      'File path relative to chart root (e.g., "templates/deployment.yaml", "values.yaml", "Chart.yaml")'
    ),

  old_str: z
    .string()
    .optional()
    .describe(
      'Exact string to find and replace. Required for str_replace command. Must match exactly (case-sensitive). For large replacements (>50 chars), fuzzy matching is used.'
    ),

  new_str: z
    .string()
    .optional()
    .describe(
      'Replacement string. Required for str_replace and create commands. For create, this is the complete file content.'
    ),
});

const latestSubchartVersionSchema = z.object({
  chart_name: z
    .string()
    .min(1)
    .describe(
      'Name of the Helm chart to query. Examples: "redis", "postgresql", "nginx-ingress", "prometheus"'
    ),
});

const latestKubernetesVersionSchema = z.object({
  semver_field: z
    .enum(['major', 'minor', 'patch'])
    .describe(
      'Which semantic version component to return: "major" (1), "minor" (1.32), or "patch" (1.32.1)'
    ),
});

const recommendedDependencySchema = z.object({
  requirement: z
    .string()
    .min(3)
    .describe(
      'User requirement or service needed. Examples: "Redis", "PostgreSQL database", "NGINX ingress", "message queue"'
    ),
});

// ============================================================================
// Type Inference from Schemas
// ============================================================================

type TextEditorParams = z.infer<typeof textEditorSchema>;
type LatestSubchartVersionParams = z.infer<typeof latestSubchartVersionSchema>;
type LatestKubernetesVersionParams = z.infer<typeof latestKubernetesVersionSchema>;
type RecommendedDependencyParams = z.infer<typeof recommendedDependencySchema>;

// ============================================================================
// Tool 1: Text Editor
// ============================================================================
// Purpose: Create, view, and edit Helm chart files
// Migrated from: pkg/llm/execute-action.go:510-649
// Status: Schema complete, execution handlers need implementation (Task #10)
// ============================================================================

export const textEditorTool = tool({
  description: `Create, view, and edit Helm chart files in the workspace.

Supports three operations:
- view: Read current file contents
- str_replace: Find and replace exact string in file (uses exact matching)
- create: Create a new file with content

The tool maintains workspace state and logs all operations for debugging.`,

  inputSchema: textEditorSchema,

  execute: async (input: TextEditorParams, options) => {
    const { command, path, old_str, new_str } = input;

    // Validation
    if (command === 'str_replace') {
      if (!old_str || !new_str) {
        return {
          success: false,
          error: 'str_replace command requires both old_str and new_str parameters',
        };
      }
    }

    if (command === 'create') {
      if (!new_str) {
        return {
          success: false,
          error: 'create command requires new_str parameter with file content',
        };
      }
    }

    // NOTE: Workspace context must be passed through route handler context
    // In a real implementation, this would be available from the Vercel AI SDK context
    // For now, we'll use a placeholder that should be injected by the route handler
    const workspaceId = process.env.WORKSPACE_ID || '';

    if (!workspaceId) {
      return {
        success: false,
        error: 'Workspace context not available. WORKSPACE_ID environment variable not set.',
      };
    }

    try {
      console.log('[textEditorTool] Executing command', {
        command,
        path,
        workspaceId,
      });

      let result;

      switch (command) {
        case 'view': {
          result = await viewFile(workspaceId, path);
          break;
        }

        case 'str_replace': {
          result = await replaceTextInFile(
            workspaceId,
            path,
            old_str!,
            new_str!
          );
          break;
        }

        case 'create': {
          result = await createFile(workspaceId, path, new_str!);
          break;
        }

        default:
          return {
            success: false,
            error: `Unknown command: ${command}`,
          };
      }

      // Log the result
      if (result.success) {
        console.log(`[textEditorTool] Command succeeded: ${command}`);
      } else {
        console.warn(`[textEditorTool] Command failed: ${command}`, result.error);
      }

      return result;
    } catch (error) {
      console.error('[textEditorTool] Unexpected error:', error);
      return {
        success: false,
        error: `Unexpected error: ${String(error)}`,
      };
    }
  },
});

// ============================================================================
// Tool 2: Latest Subchart Version
// ============================================================================
// Purpose: Query ArtifactHub for latest Helm subchart versions
// Migrated from: pkg/llm/conversational.go:100-113, 192-209
// Status: Schema complete, execution handlers need implementation (Task #10)
// ============================================================================

export const latestSubchartVersionTool = tool({
  description: `Query ArtifactHub to get the latest version of a Helm subchart.

Returns the most recent stable version number for popular Helm charts like:
- redis, postgresql, mysql, mongodb (databases)
- nginx-ingress, traefik, kong (ingress controllers)
- prometheus, grafana, elasticsearch (monitoring)

Returns "?" if the chart is not found in ArtifactHub.`,

  inputSchema: latestSubchartVersionSchema,

  execute: async (input: LatestSubchartVersionParams, options) => {
    const { chart_name } = input;

    try {
      console.log(
        `[latestSubchartVersionTool] Querying ArtifactHub for: ${chart_name}`
      );

      // Query ArtifactHub for the chart version
      const version = await fetchLatestSubchartVersion(chart_name);

      if (version === '?') {
        console.warn(`[latestSubchartVersionTool] Chart not found: ${chart_name}`);
        return {
          version: '?',
          found: false,
          chart_name,
          message: `Chart "${chart_name}" not found in ArtifactHub`,
        };
      }

      console.log(
        `[latestSubchartVersionTool] Found version ${version} for ${chart_name}`
      );

      return {
        version,
        found: true,
        chart_name,
        message: `Latest version of ${chart_name} is ${version}`,
      };
    } catch (error) {
      console.error(
        `[latestSubchartVersionTool] Error querying ${chart_name}:`,
        error
      );
      return {
        version: '?',
        found: false,
        chart_name,
        error: String(error),
      };
    }
  },
});

// ============================================================================
// Tool 3: Latest Kubernetes Version
// ============================================================================
// Purpose: Return current stable Kubernetes version
// Migrated from: pkg/llm/conversational.go:114-127, 175-191
// Status: Schema complete, execution handlers need implementation (Task #10)
// Note: Current Go implementation uses hardcoded values (K8s 1.32.1)
// ============================================================================

export const latestKubernetesVersionTool = tool({
  description: `Get the latest stable Kubernetes version.

Returns the current stable release version for Kubernetes, useful for:
- Setting kubeVersion constraints in Chart.yaml
- Recommending API versions for resources
- Compatibility checking

Can return major (e.g., "1"), minor (e.g., "1.32"), or patch (e.g., "1.32.1") versions.`,

  inputSchema: latestKubernetesVersionSchema,

  execute: async (input: LatestKubernetesVersionParams, options) => {
    const { semver_field } = input;

    try {
      console.log(
        `[latestKubernetesVersionTool] Getting K8s version: ${semver_field}`
      );

      // Fetch the version component (major, minor, or patch)
      const version = await getK8sVersionComponent(semver_field);

      console.log(
        `[latestKubernetesVersionTool] Retrieved ${semver_field}: ${version}`
      );

      return {
        version,
        field: semver_field,
        source: 'kubernetes-release-api',
        success: true,
        message: `Latest K8s ${semver_field} version: ${version}`,
      };
    } catch (error) {
      console.error(
        `[latestKubernetesVersionTool] Error fetching K8s version:`,
        error
      );
      return {
        version: '?',
        field: semver_field,
        source: 'error',
        success: false,
        error: String(error),
      };
    }
  },
});

// ============================================================================
// Tool 4: Recommended Dependency (Future Enhancement)
// ============================================================================
// Purpose: AI-powered Helm subchart recommendations
// Migrated from: pkg/llm/plan.go:73-88 (commented out in original)
// Status: Schema defined, not currently active
// Priority: Optional enhancement after core migration complete
// ============================================================================

export const recommendedDependencyTool = tool({
  description: `Recommend the best Helm subchart to satisfy a user requirement.

Uses ArtifactHub search combined with intelligent ranking to find the most
appropriate chart for needs like:
- "Redis cache" → recommends bitnami/redis
- "PostgreSQL database" → recommends bitnami/postgresql
- "message queue" → recommends bitnami/rabbitmq or apache/kafka

Ranks results by popularity, official status, maintenance, and relevance.`,

  inputSchema: recommendedDependencySchema,

  execute: async (input: RecommendedDependencyParams, options) => {
    const { requirement } = input;

    try {
      console.log(
        `[recommendedDependencyTool] Finding charts for: ${requirement}`
      );

      // Search ArtifactHub for relevant charts
      const results = await searchArtifactHub(requirement);

      if (!results || results.length === 0) {
        console.warn(
          `[recommendedDependencyTool] No charts found for: ${requirement}`
        );
        return {
          found: false,
          requirement,
          recommendations: [],
          message: `No Helm charts found matching "${requirement}"`,
        };
      }

      // Rank results by popularity and relevance
      const ranked = results
        .map((pkg) => ({
          ...pkg,
          score: calculateRecommendationScore(pkg),
        }))
        .sort((a, b) => b.score - a.score);

      // Return top recommendation with alternatives
      const topRecommendation = ranked[0];
      const alternatives = ranked.slice(1, 3);

      console.log(
        `[recommendedDependencyTool] Top recommendation: ${topRecommendation.name}@${topRecommendation.version}`
      );

      return {
        found: true,
        requirement,
        recommendation: {
          name: topRecommendation.name,
          version: topRecommendation.version,
          repository: topRecommendation.repository,
          description: topRecommendation.description,
          stars: topRecommendation.stars,
          score: topRecommendation.score,
        },
        alternatives: alternatives.map((pkg) => ({
          name: pkg.name,
          version: pkg.version,
          repository: pkg.repository,
          stars: pkg.stars,
        })),
        message: `Recommended: ${topRecommendation.name}/${topRecommendation.name} (${topRecommendation.version})`,
      };
    } catch (error) {
      console.error(
        `[recommendedDependencyTool] Error finding charts for ${requirement}:`,
        error
      );
      return {
        found: false,
        requirement,
        error: String(error),
        recommendations: [],
      };
    }
  },
});

// Helper function to score chart recommendations
function calculateRecommendationScore(pkg: {
  stars?: number;
  verified?: boolean;
}): number {
  let score = 0;

  // Base score from star count
  if (pkg.stars) {
    score += Math.min(pkg.stars / 10, 100); // Cap at 100 points
  }

  // Bonus for verified/official charts
  if (pkg.verified) {
    score += 200;
  }

  return score;
}

// ============================================================================
// Tool Registry Export
// ============================================================================
// Export all tools for use in API route handlers
// Usage: Import and pass to streamText({ tools: { ...chartsmithTools } })
// ============================================================================

export const chartsmithTools = {
  text_editor: textEditorTool,
  latest_subchart_version: latestSubchartVersionTool,
  latest_kubernetes_version: latestKubernetesVersionTool,
  recommended_dependency: recommendedDependencyTool, // Optional, can be omitted
};

// ============================================================================
// Type Exports for TypeScript
// ============================================================================
// Export types for tool parameters and responses for use elsewhere in app
// ============================================================================

export type TextEditorCommand = 'view' | 'str_replace' | 'create';
export type SemverField = 'major' | 'minor' | 'patch';

// Re-export parameter types
export type {
  TextEditorParams,
  LatestSubchartVersionParams,
  LatestKubernetesVersionParams,
  RecommendedDependencyParams,
};
