import { z } from 'zod';

/**
 * AI SDK Tool Definitions for Chartsmith
 *
 * These tools mirror the functionality available in the Go backend,
 * enabling the AI to interact with Helm charts and Kubernetes resources.
 *
 * Note: Tool execution is handled by the Go backend via the existing
 * realtime infrastructure. These definitions are used for:
 * 1. Type-safe tool schemas with Zod
 * 2. AI SDK streamText compatibility
 * 3. Future migration to full Next.js-based tool execution
 */

/**
 * Zod schemas for tool parameters
 */
export const textEditorSchema = z.object({
  command: z
    .enum(['view', 'str_replace', 'create'])
    .describe('The operation to perform on the file'),
  path: z.string().describe('The file path relative to the chart root'),
  old_str: z
    .string()
    .optional()
    .describe('The string to replace (required for str_replace command)'),
  new_str: z
    .string()
    .optional()
    .describe(
      'The new string to insert (required for str_replace and create commands)'
    ),
});

export const kubernetesVersionSchema = z.object({
  semver_field: z
    .enum(['major', 'minor', 'patch'])
    .describe('The semver field to return: major (e.g., "1"), minor (e.g., "1.32"), or patch (e.g., "1.32.1")'),
});

export const subchartVersionSchema = z.object({
  chart_name: z
    .string()
    .describe('The name of the Helm chart to look up on ArtifactHub'),
});

/**
 * Tool execute functions - can be used inline with streamText
 */
export async function executeKubernetesVersion({ semver_field }: z.infer<typeof kubernetesVersionSchema>) {
  switch (semver_field) {
    case 'major':
      return { version: '1', semver_field };
    case 'minor':
      return { version: '1.32', semver_field };
    case 'patch':
      return { version: '1.32.1', semver_field };
    default:
      return { version: '1.32.1', semver_field };
  }
}

export async function executeSubchartVersion({ chart_name }: z.infer<typeof subchartVersionSchema>) {
  try {
    const response = await fetch(
      `https://artifacthub.io/api/v1/packages/search?kind=0&ts_query_web=${encodeURIComponent(chart_name)}&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        chart_name,
        version: '1.0.0',
        source: 'mock' as const,
        message: 'Using mock version - ArtifactHub API unavailable',
      };
    }

    const data = await response.json();

    if (data.packages && data.packages.length > 0) {
      const pkg = data.packages[0];
      return {
        chart_name,
        version: pkg.version || '1.0.0',
        repository: pkg.repository?.name as string | undefined,
        source: 'artifacthub' as const,
      };
    }

    return {
      chart_name,
      version: '1.0.0',
      source: 'mock' as const,
      message: `No chart found for "${chart_name}" on ArtifactHub`,
    };
  } catch (error) {
    return {
      chart_name,
      version: '1.0.0',
      source: 'mock' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
