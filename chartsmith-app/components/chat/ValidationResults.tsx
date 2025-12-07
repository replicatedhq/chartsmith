"use client";

import React, { useState, useMemo } from "react";
import { useAtom } from "jotai";
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { validationByIdAtom } from "@/atoms/validationAtoms";
import type { ValidationIssue, ValidationResult } from "@/lib/ai/tools/validateChart";

interface ValidationResultsProps {
  validationId: string;
}

/**
 * Component that displays validation results from the validateChart tool.
 * Follows the PlanChatMessage pattern with collapsible sections.
 */
export function ValidationResults({ validationId }: ValidationResultsProps) {
  const { theme } = useTheme();
  const [validationGetter] = useAtom(validationByIdAtom);
  const validationData = validationGetter(validationId);

  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [showFullDetails, setShowFullDetails] = useState(false);

  if (!validationData) {
    return (
      <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"}`}>
        <div className="flex items-center gap-2">
          <div
            className={`rounded-full h-4 w-4 border-2 ${
              theme === "dark" ? "border-gray-400" : "border-gray-500"
            } border-t-transparent animate-spin`}
          />
          <span className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            Loading validation results...
          </span>
        </div>
      </div>
    );
  }

  const result = validationData.result;

  // Collect and sort all issues by severity
  const allIssues = useMemo(() => {
    const issues: ValidationIssue[] = [
      ...(result.results.helm_lint?.issues || []),
      ...(result.results.helm_template?.issues || []),
      ...(result.results.kube_score?.issues || []),
    ];

    // Sort by severity: critical > warning > info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [result]);

  // Count issues by severity
  const issueCounts = useMemo(() => {
    return allIssues.reduce(
      (acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [allIssues]);

  const toggleIssue = (issueId: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return theme === "dark" ? "text-green-400 bg-green-500/10" : "text-green-600 bg-green-100";
      case "warning":
        return theme === "dark" ? "text-yellow-400 bg-yellow-500/10" : "text-yellow-600 bg-yellow-100";
      case "fail":
        return theme === "dark" ? "text-red-400 bg-red-500/10" : "text-red-600 bg-red-100";
      default:
        return theme === "dark" ? "text-gray-400 bg-gray-500/10" : "text-gray-600 bg-gray-100";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSummaryText = () => {
    const parts: string[] = [];
    if (issueCounts.critical) parts.push(`${issueCounts.critical} critical`);
    if (issueCounts.warning) parts.push(`${issueCounts.warning} warning${issueCounts.warning > 1 ? "s" : ""}`);
    if (issueCounts.info) parts.push(`${issueCounts.info} info`);
    return parts.length > 0 ? parts.join(", ") : "No issues found";
  };

  return (
    <div className={`p-3 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${theme === "dark" ? "text-primary/70" : "text-primary/70"}`}>
          Validation Results
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(result.overall_status)}`}>
          {result.overall_status.toUpperCase()}
        </span>
      </div>

      {/* Summary */}
      <div className={`text-sm mb-3 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
        {result.overall_status === "pass" ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>All checks passed! Chart is ready for deployment.</span>
          </div>
        ) : (
          <span>{getSummaryText()}</span>
        )}
      </div>

      {/* Issues List */}
      {allIssues.length > 0 && (
        <div className="space-y-2">
          {allIssues.map((issue, index) => {
            const issueId = `${issue.source}-${index}`;
            const isExpanded = expandedIssues.has(issueId);

            return (
              <div
                key={issueId}
                className={`rounded-lg cursor-pointer ${
                  theme === "dark" ? "bg-dark-surface hover:bg-dark-surface/80" : "bg-white hover:bg-gray-50"
                } transition-colors`}
                onClick={() => toggleIssue(issueId)}
              >
                <div className="p-2 flex items-start gap-2">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>
                      {issue.message}
                    </div>
                    {issue.file && (
                      <div className={`text-xs font-mono ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                        {issue.file}
                        {issue.line ? `:${issue.line}` : ""}
                      </div>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className={`w-4 h-4 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`} />
                  )}
                </div>

                {isExpanded && (
                  <div className={`px-8 pb-3 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    <div className="mb-1">
                      <span className="font-medium">Source:</span> {issue.source.replace("_", " ")}
                      {issue.check && ` (${issue.check})`}
                    </div>
                    {issue.resource && (
                      <div className="mb-1">
                        <span className="font-medium">Resource:</span> {issue.resource}
                      </div>
                    )}
                    {issue.suggestion && (
                      <div
                        className={`mt-2 p-2 rounded text-xs ${
                          theme === "dark" ? "bg-dark-border/60" : "bg-gray-100"
                        }`}
                      >
                        <span className="font-medium">Suggested fix:</span> {issue.suggestion}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Kube-score summary */}
      {result.results.kube_score && result.results.kube_score.status !== "skipped" && (
        <div
          className={`mt-3 pt-3 border-t ${
            theme === "dark" ? "border-dark-border/40" : "border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              Best Practices Score:
            </span>
            <span className={`text-sm font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>
              {result.results.kube_score.score}/10
              <span className={`text-xs ml-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                ({result.results.kube_score.passed_checks}/{result.results.kube_score.total_checks} checks)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div
        className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
          theme === "dark" ? "border-dark-border/40 text-gray-500" : "border-gray-200 text-gray-400"
        }`}
      >
        <span>Completed in {result.duration_ms}ms</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFullDetails(!showFullDetails);
          }}
          className={`hover:underline ${theme === "dark" ? "text-primary/70" : "text-primary"}`}
        >
          {showFullDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* Full details panel */}
      {showFullDetails && (
        <div
          className={`mt-2 p-2 rounded text-xs font-mono overflow-auto max-h-48 ${
            theme === "dark" ? "bg-dark-surface text-gray-300" : "bg-gray-50 text-gray-600"
          }`}
        >
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
