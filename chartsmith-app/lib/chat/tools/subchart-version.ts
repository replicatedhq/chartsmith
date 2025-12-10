/**
 * Subchart Version Tool
 *
 * Queries Artifact Hub API to get the latest version of a Helm subchart.
 * This matches the functionality in the Go backend (pkg/recommendations).
 */

import { z } from "zod";
import { tool } from "ai";

/**
 * Input schema for the subchart version tool
 */
export const subchartVersionInputSchema = z.object({
  chart_name: z
    .string()
    .min(1)
    .describe("The subchart name to get the latest version of (e.g., 'postgresql', 'redis', 'nginx')"),
});

export type SubchartVersionInput = z.infer<typeof subchartVersionInputSchema>;

/**
 * Artifact Hub API response structure
 */
interface ArtifactHubSearchResponse {
  packages: Array<{
    name: string;
    version: string;
    repository: {
      name: string;
      url: string;
    };
  }>;
}

/**
 * Artifact Hub API base URL
 */
const ARTIFACT_HUB_API = "https://artifacthub.io/api/v1";

/**
 * Execute the subchart version lookup
 */
export async function executeSubchartVersion(
  input: SubchartVersionInput
): Promise<string> {
  try {
    const searchUrl = `${ARTIFACT_HUB_API}/packages/search?kind=0&ts_query_web=${encodeURIComponent(input.chart_name)}&limit=5`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.error("Artifact Hub API error:", response.status);
      return "?";
    }

    const data: ArtifactHubSearchResponse = await response.json();

    if (!data.packages || data.packages.length === 0) {
      return "?";
    }

    // Find exact match first, otherwise use first result
    const exactMatch = data.packages.find(
      (pkg) => pkg.name.toLowerCase() === input.chart_name.toLowerCase()
    );

    const pkg = exactMatch ?? data.packages[0];
    return pkg.version;
  } catch (error) {
    // Match Go behavior: return "?" on error
    console.error("Failed to fetch subchart version:", error);
    return "?";
  }
}

/**
 * Create the subchart version tool for Vercel AI SDK
 */
export function createSubchartVersionTool() {
  return tool({
    description: "Return the latest version of a Helm subchart from Artifact Hub. Use this when adding dependencies to Chart.yaml or when a user asks about chart versions.",
    inputSchema: subchartVersionInputSchema,
    execute: async (input: SubchartVersionInput) => {
      return executeSubchartVersion(input);
    },
  });
}
