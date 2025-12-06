/**
 * PR3.0: K8s to Helm Conversion Tool
 *
 * AI SDK tool that triggers the K8s to Helm conversion pipeline.
 * This tool is available when chatMessageId is provided.
 */

import { tool } from "ai";
import { z } from "zod";
import { startConversion } from "../conversion";

/**
 * Creates the convertK8sToHelm tool
 *
 * @param authHeader - Authorization header to forward to Go backend
 * @param workspaceId - The current workspace ID
 * @param chatMessageId - The chat message ID to associate with the conversion
 * @returns A configured AI SDK tool
 */
export function createConvertK8sTool(
  authHeader: string | undefined,
  workspaceId: string,
  chatMessageId: string
) {
  return tool({
    description: `Convert Kubernetes manifests to a Helm chart.

Provide an array of K8s manifest files with their paths and YAML content.
The conversion will:
1. Analyze the K8s resources and their dependencies
2. Sort files by dependency order
3. Convert each manifest to a Helm template
4. Generate values.yaml with configurable parameters
5. Create a complete, production-ready Helm chart

Example usage:
- Convert a deployment, service, and configmap to Helm
- Convert an entire K8s application to a Helm chart`,
    inputSchema: z.object({
      files: z
        .array(
          z.object({
            filePath: z
              .string()
              .describe("Original file path (e.g., 'deployment.yaml')"),
            fileContent: z
              .string()
              .describe("Full YAML content of the Kubernetes manifest"),
          })
        )
        .describe("Array of K8s manifest files to convert"),
    }),
    execute: async ({
      files,
    }: {
      files: { filePath: string; fileContent: string }[];
    }) => {
      try {
        const conversionId = await startConversion(
          authHeader,
          workspaceId,
          chatMessageId,
          files.map((f) => ({
            filePath: f.filePath,
            fileContent: f.fileContent,
          }))
        );

        return {
          success: true,
          conversionId,
          message: `Conversion started. Track progress with conversion ID: ${conversionId}. The ConversionProgress component will display real-time status updates.`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to start conversion: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

