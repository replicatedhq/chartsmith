package validation

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

// RunValidation orchestrates the three-stage validation pipeline:
// 1. helm lint - Check chart syntax and structure
// 2. helm template - Render templates to YAML
// 3. kube-score - Check Kubernetes best practices
//
// The pipeline runs sequentially. Stage 2 only runs if Stage 1 passes.
// Stage 3 only runs if Stage 2 succeeds. Kube-score failure is non-fatal.
func RunValidation(ctx context.Context, request ValidationRequest) (*ValidationResult, error) {
	startTime := time.Now()

	result := &ValidationResult{
		OverallStatus: "pass",
		Timestamp:     startTime,
		Results: ValidationResults{
			HelmLint: &LintResult{
				Status: "fail",
				Issues: []ValidationIssue{},
			},
		},
	}

	// Get chart files from workspace
	charts, err := workspace.ListCharts(ctx, request.WorkspaceID, request.RevisionNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to list charts: %w", err)
	}

	if len(charts) == 0 {
		return nil, fmt.Errorf("no charts found in workspace")
	}

	// Use the first chart (typical case is one chart per workspace)
	chart := charts[0]

	logger.Debug("Running validation",
		zap.String("workspaceId", request.WorkspaceID),
		zap.Int("revisionNumber", request.RevisionNumber),
		zap.String("chartName", chart.Name),
		zap.Int("fileCount", len(chart.Files)))

	// Build file map from chart files
	files := make(map[string]string)
	for _, file := range chart.Files {
		// Use pending content if available, otherwise use committed content
		content := file.Content
		if file.ContentPending != nil && *file.ContentPending != "" {
			content = *file.ContentPending
		}
		files[file.FilePath] = content
	}

	// Write chart to temp directory
	chartPath, err := writeChartToTempDir(files)
	if err != nil {
		return nil, fmt.Errorf("failed to write chart to temp dir: %w", err)
	}
	defer os.RemoveAll(chartPath)

	logger.Debug("Chart written to temp directory", zap.String("chartPath", chartPath))

	// Stage 1: helm lint
	lintResult, err := runHelmLint(ctx, chartPath, request.Values)
	if err != nil {
		return nil, fmt.Errorf("helm lint failed: %w", err)
	}
	result.Results.HelmLint = lintResult

	logger.Debug("Helm lint completed",
		zap.String("status", lintResult.Status),
		zap.Int("issueCount", len(lintResult.Issues)))

	// Check if we should stop after lint
	if lintResult.Status == "fail" && request.StrictMode {
		result.OverallStatus = "fail"
		result.DurationMs = time.Since(startTime).Milliseconds()
		return result, nil
	}

	// Update overall status based on lint issues
	for _, issue := range lintResult.Issues {
		if issue.Severity == "critical" {
			result.OverallStatus = "fail"
		} else if issue.Severity == "warning" && result.OverallStatus == "pass" {
			result.OverallStatus = "warning"
		}
	}

	// Stage 2: helm template
	templateResult, renderedYAML, err := runHelmTemplate(ctx, chartPath, request.Values, request.KubeVersion)
	if err != nil {
		return nil, fmt.Errorf("helm template failed: %w", err)
	}
	result.Results.HelmTemplate = templateResult

	logger.Debug("Helm template completed",
		zap.String("status", templateResult.Status),
		zap.Int("resourceCount", templateResult.RenderedResources),
		zap.Int("outputSize", templateResult.OutputSizeBytes))

	// Update overall status based on template issues
	if templateResult.Status == "fail" {
		result.OverallStatus = "fail"
		result.DurationMs = time.Since(startTime).Milliseconds()
		return result, nil
	}

	// Stage 3: kube-score (only if template succeeded and produced output)
	if len(renderedYAML) > 0 {
		scoreResult, err := runKubeScore(ctx, renderedYAML)
		if err != nil {
			// kube-score failure is non-fatal, log and continue
			logger.Warn("kube-score failed", zap.Error(err))
			scoreResult = &ScoreResult{
				Status:       "skipped",
				Score:        0,
				TotalChecks:  0,
				PassedChecks: 0,
				Issues: []ValidationIssue{{
					Severity:   "info",
					Source:     "kube_score",
					Message:    fmt.Sprintf("kube-score check skipped: %v", err),
					Suggestion: "Ensure kube-score is installed for best practices checking",
				}},
			}
		}
		result.Results.KubeScore = scoreResult

		logger.Debug("Kube-score completed",
			zap.String("status", scoreResult.Status),
			zap.Int("score", scoreResult.Score),
			zap.Int("totalChecks", scoreResult.TotalChecks),
			zap.Int("passedChecks", scoreResult.PassedChecks))

		// Update overall status based on kube-score
		if scoreResult.Status == "fail" && result.OverallStatus == "pass" {
			result.OverallStatus = "fail"
		} else if scoreResult.Status == "warning" && result.OverallStatus == "pass" {
			result.OverallStatus = "warning"
		}
	}

	result.DurationMs = time.Since(startTime).Milliseconds()

	logger.Info("Validation completed",
		zap.String("overallStatus", result.OverallStatus),
		zap.Int64("durationMs", result.DurationMs))

	return result, nil
}
