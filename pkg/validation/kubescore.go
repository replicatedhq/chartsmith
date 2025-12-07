package validation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
)

// kubeScoreOutput represents the JSON output from kube-score.
type kubeScoreOutput []kubeScoreObject

// kubeScoreObject represents a scored Kubernetes object.
type kubeScoreObject struct {
	ObjectName string            `json:"object_name"`
	TypeMeta   kubeScoreTypeMeta `json:"type_meta"`
	Checks     []kubeScoreCheck  `json:"checks"`
}

// kubeScoreTypeMeta contains Kubernetes type information.
type kubeScoreTypeMeta struct {
	APIVersion string `json:"api_version"`
	Kind       string `json:"kind"`
}

// kubeScoreCheck represents a single check result.
type kubeScoreCheck struct {
	Check    kubeScoreCheckInfo `json:"check"`
	Grade    int                `json:"grade"`
	Comments []kubeScoreComment `json:"comments"`
}

// kubeScoreCheckInfo contains check metadata.
type kubeScoreCheckInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Comment  string `json:"comment,omitempty"`
	Optional bool   `json:"optional"`
}

// kubeScoreComment contains additional context for a check.
type kubeScoreComment struct {
	Path        string `json:"path"`
	Summary     string `json:"summary"`
	Description string `json:"description"`
}

// suggestions maps kube-score check names to fix suggestions.
var suggestions = map[string]string{
	"container-resources":               "Add resources.limits.memory and resources.limits.cpu to container spec",
	"container-security-context":        "Set securityContext.runAsNonRoot: true and readOnlyRootFilesystem: true",
	"container-image-tag":               "Use specific image tag instead of :latest (e.g., nginx:1.21.0)",
	"container-image-pull-policy":       "Set imagePullPolicy to Always or use a specific image tag",
	"pod-probes":                        "Add readinessProbe and livenessProbe to containers",
	"pod-networkpolicy":                 "Create a NetworkPolicy for this namespace",
	"deployment-has-poddisruptionbudget": "Create a PodDisruptionBudget for high availability",
	"deployment-has-host-podantiaffinity": "Add pod anti-affinity rules to spread pods across nodes",
	"statefulset-has-servicename":       "Ensure StatefulSet has a headless Service configured",
	"container-ephemeral-storage-limit": "Set resources.limits.ephemeral-storage to prevent disk exhaustion",
	"container-cpu-limit":               "Set resources.limits.cpu to ensure fair resource allocation",
	"container-memory-limit":            "Set resources.limits.memory to prevent OOM issues",
	"container-cpu-requests-equal-limits": "Set CPU requests equal to limits for guaranteed QoS",
	"container-memory-requests-equal-limits": "Set memory requests equal to limits for guaranteed QoS",
	"service-type":                      "Consider using ClusterIP instead of LoadBalancer for internal services",
	"stable-version":                    "Use stable API versions instead of alpha/beta versions",
}

// runKubeScore executes kube-score on the rendered YAML.
// If kube-score is not installed, it returns a result with status "skipped".
func runKubeScore(ctx context.Context, renderedYAML []byte) (*ScoreResult, error) {
	// Check if kube-score is installed
	_, err := exec.LookPath("kube-score")
	if err != nil {
		// kube-score not installed, return skipped result
		return &ScoreResult{
			Status:       "skipped",
			Score:        0,
			TotalChecks:  0,
			PassedChecks: 0,
			Issues:       []ValidationIssue{},
		}, nil
	}

	// Write rendered YAML to temp file
	tmpFile, err := os.CreateTemp("", "rendered-*.yaml")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(renderedYAML); err != nil {
		tmpFile.Close()
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}
	tmpFile.Close()

	// Run kube-score with JSON output
	cmd := exec.CommandContext(ctx, "kube-score", "score", tmpFile.Name(), "--output-format", "json")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// kube-score returns non-zero exit code if there are issues, so we ignore the error
	_ = cmd.Run()

	// Parse JSON output
	var output kubeScoreOutput
	if err := json.Unmarshal(stdout.Bytes(), &output); err != nil {
		// If we can't parse the output, return an error issue
		return &ScoreResult{
			Status:       "fail",
			Score:        0,
			TotalChecks:  0,
			PassedChecks: 0,
			Issues: []ValidationIssue{{
				Severity:   "warning",
				Source:     "kube_score",
				Message:    fmt.Sprintf("Failed to parse kube-score output: %v", err),
				Suggestion: "Ensure kube-score is properly installed and the chart renders valid YAML",
			}},
		}, nil
	}

	return parseKubeScoreOutput(output), nil
}

// parseKubeScoreOutput converts kube-score JSON output to our result format.
func parseKubeScoreOutput(output kubeScoreOutput) *ScoreResult {
	result := &ScoreResult{
		Status:       "pass",
		Score:        10,
		TotalChecks:  0,
		PassedChecks: 0,
		Issues:       []ValidationIssue{},
	}

	for _, obj := range output {
		resourceName := fmt.Sprintf("%s/%s/%s", obj.TypeMeta.APIVersion, obj.TypeMeta.Kind, obj.ObjectName)

		for _, check := range obj.Checks {
			result.TotalChecks++

			// Grade 10 = OK (passed), lower grades are issues
			if check.Grade >= 10 {
				result.PassedChecks++
				continue
			}

			// Map grade to severity
			severity := mapGradeToSeverity(check.Grade)
			if severity == "" {
				// Grade 7-9 are passing, skip
				result.PassedChecks++
				continue
			}

			// Build message from comments
			var messages []string
			for _, comment := range check.Comments {
				if comment.Summary != "" {
					messages = append(messages, comment.Summary)
				}
			}
			message := check.Check.Name
			if len(messages) > 0 {
				message = messages[0]
			}

			issue := ValidationIssue{
				Severity:   severity,
				Source:     "kube_score",
				Resource:   resourceName,
				Check:      check.Check.ID,
				Message:    message,
				Suggestion: getSuggestion(check.Check.ID),
			}

			result.Issues = append(result.Issues, issue)

			// Update overall status based on severity
			if severity == "critical" {
				result.Status = "fail"
			} else if severity == "warning" && result.Status == "pass" {
				result.Status = "warning"
			}
		}
	}

	// Calculate score (0-10 scale)
	if result.TotalChecks > 0 {
		result.Score = (result.PassedChecks * 10) / result.TotalChecks
	}

	return result
}

// mapGradeToSeverity maps kube-score grades to our severity levels.
// Grades: 1 = CRITICAL, 5 = WARNING, 7+ = OK (pass)
func mapGradeToSeverity(grade int) string {
	switch {
	case grade <= 1:
		return "critical"
	case grade <= 5:
		return "warning"
	default:
		return "" // Grade 7-10 = pass, don't include as issue
	}
}

// getSuggestion returns a fix suggestion for a kube-score check.
func getSuggestion(checkID string) string {
	if suggestion, ok := suggestions[checkID]; ok {
		return suggestion
	}
	return "Review Kubernetes best practices documentation for this check"
}
