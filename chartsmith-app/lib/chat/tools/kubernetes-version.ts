/**
 * Kubernetes Version Tool
 *
 * Returns the latest Kubernetes version based on the requested semver field.
 * This matches the functionality in the Go backend (pkg/llm/conversational.go).
 */

import { z } from "zod";
import { tool } from "ai";

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
 */
export function executeKubernetesVersion(input: KubernetesVersionInput): string {
  return KUBERNETES_VERSIONS[input.semver_field];
}

/**
 * Create the Kubernetes version tool for Vercel AI SDK
 */
export function createKubernetesVersionTool() {
  return tool({
    description: "Return the latest version of Kubernetes. Use this when a user asks about Kubernetes versions or when you need to set apiVersion in chart templates.",
    inputSchema: kubernetesVersionInputSchema,
    execute: async (input: KubernetesVersionInput) => {
      return executeKubernetesVersion(input);
    },
  });
}
