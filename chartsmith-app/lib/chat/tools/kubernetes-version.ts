/**
 * Kubernetes Version Tool
 *
 * Returns the latest Kubernetes version based on the requested semver field.
 * This matches the functionality in the Go backend (pkg/llm/conversational.go).
 */

import { z } from "zod";
import { tool } from "ai";
import type { ToolFactory } from "./registry";

/**
 * Input schema for the kubernetes version tool
 */
export const kubernetesVersionInputSchema = z.object({
  semver_field: z
    .enum(["major", "minor", "patch"])
    .describe("One of 'major', 'minor', or 'patch'"),
});

export type KubernetesVersionInput = z.infer<typeof kubernetesVersionInputSchema>;

/**
 * Current Kubernetes versions (should be updated periodically)
 * These match the hardcoded values in the Go implementation
 */
const KUBERNETES_VERSIONS = {
  major: "1",
  minor: "1.32",
  patch: "1.32.1",
} as const;

/**
 * Execute the kubernetes version lookup
 *
 * @param input - The validated input containing semver_field
 * @returns The kubernetes version string
 */
export function executeKubernetesVersion(input: KubernetesVersionInput): string {
  return KUBERNETES_VERSIONS[input.semver_field];
}

/**
 * Tool definition for the registry (non-Zod format)
 */
export const kubernetesVersionToolFactory: ToolFactory = () => ({
  name: "latest_kubernetes_version",
  description: "Return the latest version of Kubernetes",
  parameters: {
    type: "object",
    properties: {
      semver_field: {
        type: "string",
        enum: ["major", "minor", "patch"],
        description: "One of 'major', 'minor', or 'patch'",
      },
    },
    required: ["semver_field"],
  },
  execute: async (args: Record<string, unknown>) => {
    const input = kubernetesVersionInputSchema.parse(args);
    return executeKubernetesVersion(input);
  },
});

/**
 * Create the tool in Vercel AI SDK v5 format
 */
export const kubernetesVersionTool = tool<KubernetesVersionInput, string>({
  description: "Return the latest version of Kubernetes",
  inputSchema: kubernetesVersionInputSchema,
  execute: async (input: KubernetesVersionInput) => {
    return executeKubernetesVersion(input);
  },
});
