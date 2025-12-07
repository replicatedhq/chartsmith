package validation

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"gopkg.in/yaml.v2"
)

// lintOutputPattern matches helm lint output lines like:
// [ERROR] Chart.yaml: icon is recommended
// [WARNING] templates/: directory not found
// [INFO] Chart.yaml: icon is recommended
var lintOutputPattern = regexp.MustCompile(`\[(ERROR|WARNING|INFO)\]\s+(.+)`)

// lintFileLinePattern matches file:line patterns in helm lint output
var lintFileLinePattern = regexp.MustCompile(`^([^:]+):(\d+):?\s*(.*)`)

// runHelmLint executes helm lint on the chart at chartPath.
func runHelmLint(ctx context.Context, chartPath string, values map[string]interface{}) (*LintResult, error) {
	args := []string{"lint", chartPath}

	// Handle values if provided
	var valuesFile string
	if len(values) > 0 {
		f, err := os.CreateTemp("", "values-*.yaml")
		if err != nil {
			return nil, fmt.Errorf("failed to create temp values file: %w", err)
		}
		valuesFile = f.Name()
		defer os.Remove(valuesFile)

		valuesYAML, err := yaml.Marshal(values)
		if err != nil {
			f.Close()
			return nil, fmt.Errorf("failed to marshal values: %w", err)
		}

		if _, err := f.Write(valuesYAML); err != nil {
			f.Close()
			return nil, fmt.Errorf("failed to write values file: %w", err)
		}
		f.Close()

		args = append(args, "--values", valuesFile)
	}

	cmd := exec.CommandContext(ctx, "helm", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	output := stdout.String() + stderr.String()

	// Parse output for issues
	issues := parseLintOutput(output)

	// Determine status
	status := "pass"
	if err != nil {
		status = "fail"
	} else {
		// Check if there are any critical issues
		for _, issue := range issues {
			if issue.Severity == "critical" {
				status = "fail"
				break
			}
		}
	}

	return &LintResult{
		Status: status,
		Issues: issues,
	}, nil
}

// parseLintOutput parses helm lint output into ValidationIssues.
func parseLintOutput(output string) []ValidationIssue {
	var issues []ValidationIssue
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		matches := lintOutputPattern.FindStringSubmatch(line)
		if matches == nil {
			continue
		}

		severity := mapLintSeverity(matches[1])
		message := matches[2]

		issue := ValidationIssue{
			Severity: severity,
			Source:   "helm_lint",
			Message:  message,
		}

		// Try to extract file and line from the message
		fileMatches := lintFileLinePattern.FindStringSubmatch(message)
		if fileMatches != nil {
			issue.File = fileMatches[1]
			if lineNum, err := strconv.Atoi(fileMatches[2]); err == nil {
				issue.Line = lineNum
			}
			if len(fileMatches) > 3 && fileMatches[3] != "" {
				issue.Message = fileMatches[3]
			}
		}

		// Add suggestions for common issues
		issue.Suggestion = getLintSuggestion(message)

		issues = append(issues, issue)
	}

	return issues
}

// mapLintSeverity maps helm lint severity to our severity levels.
func mapLintSeverity(helmSeverity string) string {
	switch strings.ToUpper(helmSeverity) {
	case "ERROR":
		return "critical"
	case "WARNING":
		return "warning"
	case "INFO":
		return "info"
	default:
		return "info"
	}
}

// getLintSuggestion returns a suggestion for common lint issues.
func getLintSuggestion(message string) string {
	msg := strings.ToLower(message)

	switch {
	case strings.Contains(msg, "icon is recommended"):
		return "Add an icon field to Chart.yaml pointing to a chart icon image"
	case strings.Contains(msg, "chart.yaml: version"):
		return "Ensure Chart.yaml has a valid version field following semver"
	case strings.Contains(msg, "apiversion"):
		return "Update the API version to a supported version (e.g., v2 for Helm 3)"
	case strings.Contains(msg, "directory not found"):
		return "Create the missing directory or remove the reference"
	case strings.Contains(msg, "deprecated"):
		return "Update to use non-deprecated APIs or chart features"
	default:
		return "Review the Helm chart best practices documentation"
	}
}

// runHelmTemplate executes helm template on the chart at chartPath.
// Returns the TemplateResult, rendered YAML bytes for kube-score, and any error.
func runHelmTemplate(ctx context.Context, chartPath string, values map[string]interface{}, kubeVersion string) (*TemplateResult, []byte, error) {
	args := []string{"template", "validation-check", chartPath}

	// Add kube-version if specified
	if kubeVersion != "" {
		args = append(args, "--kube-version", kubeVersion)
	}

	// Handle values if provided
	var valuesFile string
	if len(values) > 0 {
		f, err := os.CreateTemp("", "values-*.yaml")
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create temp values file: %w", err)
		}
		valuesFile = f.Name()
		defer os.Remove(valuesFile)

		valuesYAML, err := yaml.Marshal(values)
		if err != nil {
			f.Close()
			return nil, nil, fmt.Errorf("failed to marshal values: %w", err)
		}

		if _, err := f.Write(valuesYAML); err != nil {
			f.Close()
			return nil, nil, fmt.Errorf("failed to write values file: %w", err)
		}
		f.Close()

		args = append(args, "--values", valuesFile)
	}

	cmd := exec.CommandContext(ctx, "helm", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	result := &TemplateResult{
		Status:          "pass",
		Issues:          []ValidationIssue{},
		OutputSizeBytes: len(stdout.Bytes()),
	}

	if err != nil {
		result.Status = "fail"
		// Parse stderr for error details
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = err.Error()
		}

		issue := ValidationIssue{
			Severity:   "critical",
			Source:     "helm_template",
			Message:    errMsg,
			Suggestion: "Fix the template syntax error or missing values",
		}

		// Try to extract file and line from error
		issue.File, issue.Line = parseTemplateError(errMsg)

		result.Issues = append(result.Issues, issue)
		return result, nil, nil
	}

	// Count rendered resources by counting YAML document separators
	renderedYAML := stdout.Bytes()
	result.RenderedResources = countYAMLDocuments(renderedYAML)

	return result, renderedYAML, nil
}

// parseTemplateError attempts to extract file and line from a template error message.
func parseTemplateError(errMsg string) (string, int) {
	// Common patterns:
	// "parse error at (templates/deployment.yaml:15): ..."
	// "template: mychart/templates/deployment.yaml:15:10: ..."
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`at \(([^:]+):(\d+)\)`),
		regexp.MustCompile(`template: [^/]+/([^:]+):(\d+)`),
		regexp.MustCompile(`([^:]+\.yaml):(\d+)`),
	}

	for _, pattern := range patterns {
		matches := pattern.FindStringSubmatch(errMsg)
		if matches != nil {
			file := matches[1]
			line := 0
			if len(matches) > 2 {
				line, _ = strconv.Atoi(matches[2])
			}
			return file, line
		}
	}

	return "", 0
}

// countYAMLDocuments counts the number of YAML documents in the rendered output.
func countYAMLDocuments(yaml []byte) int {
	if len(yaml) == 0 {
		return 0
	}

	// Count document separators (---)
	count := 1 // At least one document if not empty
	lines := bytes.Split(yaml, []byte("\n"))
	for _, line := range lines {
		if bytes.Equal(bytes.TrimSpace(line), []byte("---")) {
			count++
		}
	}

	// Adjust for empty documents
	// Don't count empty documents at the beginning
	content := bytes.TrimSpace(yaml)
	if bytes.HasPrefix(content, []byte("---")) {
		count--
	}

	return count
}

// writeChartToTempDir writes chart files to a temporary directory structure.
func writeChartToTempDir(files map[string]string) (string, error) {
	// Create temp directory for the chart
	tempDir, err := os.MkdirTemp("", "chart-validation-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}

	// Write each file
	for path, content := range files {
		fullPath := filepath.Join(tempDir, path)

		// Create parent directories
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			os.RemoveAll(tempDir)
			return "", fmt.Errorf("failed to create directory for %s: %w", path, err)
		}

		// Write file
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			os.RemoveAll(tempDir)
			return "", fmt.Errorf("failed to write file %s: %w", path, err)
		}
	}

	return tempDir, nil
}
