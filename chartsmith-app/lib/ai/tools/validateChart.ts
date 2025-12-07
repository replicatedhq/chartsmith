/**
 * validateChart Tool
 *
 * This tool validates a Helm chart for syntax errors, template rendering issues,
 * and Kubernetes best practices. It calls the Go HTTP endpoint /api/validate
 * which runs helm lint, helm template, and kube-score.
 *
 * PR4: Chart Validation Agent
 */

import { tool } from "ai";
import { z } from "zod";
import { callGoEndpoint } from "./utils";

/**
 * Individual validation issue from any stage
 */
export interface ValidationIssue {
  severity: "critical" | "warning" | "info";
  source: "helm_lint" | "helm_template" | "kube_score";
  resource?: string;
  check?: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

/**
 * Results from helm lint stage
 */
export interface LintResult {
  status: "pass" | "fail";
  issues: ValidationIssue[];
}

/**
 * Results from helm template stage
 */
export interface TemplateResult {
  status: "pass" | "fail";
  rendered_resources: number;
  output_size_bytes: number;
  issues: ValidationIssue[];
}

/**
 * Results from kube-score stage
 */
export interface ScoreResult {
  status: "pass" | "warning" | "fail" | "skipped";
  score: number;
  total_checks: number;
  passed_checks: number;
  issues: ValidationIssue[];
}

/**
 * Complete validation result from the pipeline
 */
export interface ValidationResult {
  overall_status: "pass" | "warning" | "fail";
  timestamp: string;
  duration_ms: number;
  results: {
    helm_lint: LintResult;
    helm_template?: TemplateResult;
    kube_score?: ScoreResult;
  };
}

/**
 * Response from the validation endpoint
 */
export interface ValidationResponse {
  validation: ValidationResult;
}

/**
 * Create the validateChart tool
 *
 * @param authHeader - Authorization header to forward to Go backend
 * @param workspaceId - The current workspace ID
 * @param revisionNumber - The current revision number
 * @returns A configured AI SDK tool
 */
export function createValidateChartTool(
  authHeader: string | undefined,
  workspaceId: string,
  revisionNumber: number
) {
  return tool({
    description:
      "Validate a Helm chart for syntax errors, template rendering issues, and " +
      "Kubernetes best practices. Use this tool when the user asks to validate, " +
      "check, lint, verify, or review their chart, or when they ask about errors, " +
      "issues, or problems with the chart. This runs helm lint, helm template, " +
      "and kube-score to provide comprehensive validation results.",
    inputSchema: z.object({
      values: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Values to override for template rendering"),
      strictMode: z
        .boolean()
        .optional()
        .describe("Treat warnings as failures"),
      kubeVersion: z
        .string()
        .optional()
        .describe("Target Kubernetes version (e.g., '1.28')"),
    }),
    execute: async (params: {
      values?: Record<string, unknown>;
      strictMode?: boolean;
      kubeVersion?: string;
    }) => {
      try {
        const response = await callGoEndpoint<ValidationResponse>(
          "/api/validate",
          {
            workspaceId,
            revisionNumber,
            values: params.values,
            strictMode: params.strictMode,
            kubeVersion: params.kubeVersion,
          },
          authHeader
        );
        return response;
      } catch (error) {
        console.error("validateChart error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Validation failed unexpectedly",
        };
      }
    },
  });
}

// Export the tool factory
export default createValidateChartTool;
