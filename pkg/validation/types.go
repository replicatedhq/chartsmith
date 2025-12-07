// Package validation provides chart validation functionality using helm lint,
// helm template, and kube-score to check for syntax errors, rendering issues,
// and Kubernetes best practices.
package validation

import "time"

// ValidationRequest represents the input to the validation pipeline.
type ValidationRequest struct {
	// WorkspaceID identifies the workspace containing the chart to validate
	WorkspaceID string `json:"workspaceId"`

	// RevisionNumber specifies which revision of the workspace to validate
	RevisionNumber int `json:"revisionNumber"`

	// Values are optional value overrides for template rendering
	Values map[string]interface{} `json:"values,omitempty"`

	// StrictMode if true, treats warnings as failures
	StrictMode bool `json:"strictMode,omitempty"`

	// KubeVersion is the target Kubernetes version (e.g., "1.28")
	KubeVersion string `json:"kubeVersion,omitempty"`
}

// ValidationResult is the complete output from the validation pipeline.
type ValidationResult struct {
	// OverallStatus is "pass", "warning", or "fail"
	OverallStatus string `json:"overall_status"`

	// Timestamp is when validation started
	Timestamp time.Time `json:"timestamp"`

	// DurationMs is the total pipeline duration in milliseconds
	DurationMs int64 `json:"duration_ms"`

	// Results contains the results from each validation stage
	Results ValidationResults `json:"results"`
}

// ValidationResults contains results from each stage of the pipeline.
type ValidationResults struct {
	// HelmLint contains results from the helm lint stage
	HelmLint *LintResult `json:"helm_lint"`

	// HelmTemplate contains results from the helm template stage
	HelmTemplate *TemplateResult `json:"helm_template,omitempty"`

	// KubeScore contains results from the kube-score stage (may be nil if skipped)
	KubeScore *ScoreResult `json:"kube_score,omitempty"`
}

// LintResult contains results from helm lint.
type LintResult struct {
	// Status is "pass" or "fail"
	Status string `json:"status"`

	// Issues contains all lint findings
	Issues []ValidationIssue `json:"issues"`
}

// TemplateResult contains results from helm template.
type TemplateResult struct {
	// Status is "pass" or "fail"
	Status string `json:"status"`

	// RenderedResources is the count of K8s resources generated
	RenderedResources int `json:"rendered_resources"`

	// OutputSizeBytes is the size of rendered YAML
	OutputSizeBytes int `json:"output_size_bytes"`

	// Issues contains template errors if any
	Issues []ValidationIssue `json:"issues"`
}

// ScoreResult contains results from kube-score.
type ScoreResult struct {
	// Status is "pass", "warning", "fail", or "skipped"
	Status string `json:"status"`

	// Score is 0-10 (passed/total * 10)
	Score int `json:"score"`

	// TotalChecks is the total number of checks executed
	TotalChecks int `json:"total_checks"`

	// PassedChecks is the number of checks that passed
	PassedChecks int `json:"passed_checks"`

	// Issues contains failed checks with details
	Issues []ValidationIssue `json:"issues"`
}

// ValidationIssue represents an individual finding from any validation stage.
type ValidationIssue struct {
	// Severity is "critical", "warning", or "info"
	Severity string `json:"severity"`

	// Source is "helm_lint", "helm_template", or "kube_score"
	Source string `json:"source"`

	// Resource is the K8s resource name (kube-score only)
	Resource string `json:"resource,omitempty"`

	// Check is the check/rule name that triggered the issue
	Check string `json:"check,omitempty"`

	// Message is the human-readable description
	Message string `json:"message"`

	// File is the source file path when available
	File string `json:"file,omitempty"`

	// Line is the line number (0 if unknown)
	Line int `json:"line,omitempty"`

	// Suggestion is the recommended fix action
	Suggestion string `json:"suggestion,omitempty"`
}

// ValidationResponse wraps the validation result for the API response.
type ValidationResponse struct {
	Validation *ValidationResult `json:"validation"`
}

// ValidationErrorResponse represents an error from the validation process.
type ValidationErrorResponse struct {
	Error   string                 `json:"error"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}
