/**
 * Subchart Version Tool
 *
 * Queries Artifact Hub API to get the latest version of a Helm subchart.
 * This matches the functionality in the Go backend (pkg/recommendations).
 */

import { z } from "zod";
import { tool } from "ai";
import type { ToolFactory, ToolDependencies } from "./registry";
import type { HttpClient } from "../providers/types";

/**
 * Input schema for the subchart version tool
 */
export const subchartVersionInputSchema = z.object({
  chart_name: z
    .string()
    .min(1)
    .describe("The subchart name to get the latest version of"),
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
 *
 * @param input - The validated input containing chart_name
 * @param httpClient - HTTP client for making API requests
 * @returns The latest version string or "?" if not found
 */
export async function executeSubchartVersion(
  input: SubchartVersionInput,
  httpClient: HttpClient
): Promise<string> {
  try {
    const searchUrl = `${ARTIFACT_HUB_API}/packages/search?kind=0&ts_query_web=${encodeURIComponent(input.chart_name)}&limit=1`;

    const response = await httpClient.get<ArtifactHubSearchResponse>(searchUrl);

    if (!response.packages || response.packages.length === 0) {
      return "?";
    }

    // Find exact match first, otherwise use first result
    const exactMatch = response.packages.find(
      (pkg) => pkg.name.toLowerCase() === input.chart_name.toLowerCase()
    );

    const pkg = exactMatch ?? response.packages[0];
    return pkg.version;
  } catch (error) {
    // Match Go behavior: return "?" on error
    console.error("Failed to fetch subchart version:", error);
    return "?";
  }
}

/**
 * Tool factory for the registry (with dependency injection)
 */
export const subchartVersionToolFactory: ToolFactory = (
  deps: ToolDependencies
) => ({
  name: "latest_subchart_version",
  description: "Return the latest version of a subchart from name",
  parameters: {
    type: "object",
    properties: {
      chart_name: {
        type: "string",
        description: "The subchart name to get the latest version of",
      },
    },
    required: ["chart_name"],
  },
  execute: async (args: Record<string, unknown>) => {
    const input = subchartVersionInputSchema.parse(args);
    return executeSubchartVersion(input, deps.httpClient);
  },
});

/**
 * Create the tool in Vercel AI SDK v5 format with injected HTTP client
 */
export function createSubchartVersionTool(httpClient: HttpClient) {
  return tool<SubchartVersionInput, string>({
    description: "Return the latest version of a subchart from name",
    inputSchema: subchartVersionInputSchema,
    execute: async (input: SubchartVersionInput) => {
      return executeSubchartVersion(input, httpClient);
    },
  });
}
