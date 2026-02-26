package agent

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// validate.go runs post-agent validation on the workspace.
//
// After the agent CLI finishes editing chart files, we validate that:
// 1. helm lint passes (chart quality)
// 2. helm template succeeds (templates render correctly)
//
// This catches errors that the agent might have introduced.
// In a full integration, this would call into the existing helm-utils
// package rather than shelling out to helm directly.

// ValidationResult contains the outcome of post-run validation.
type ValidationResult struct {
	// LintPassed is true if helm lint reported no errors.
	LintPassed bool

	// TemplatePassed is true if helm template rendered successfully.
	TemplatePassed bool

	// LintOutput is the raw output from helm lint.
	LintOutput string

	// TemplateOutput is the raw output from helm template.
	TemplateOutput string

	// Errors collects all validation error messages.
	Errors []string
}

// IsValid returns true if all validations passed.
func (v *ValidationResult) IsValid() bool {
	return v.LintPassed && v.TemplatePassed
}

// Validate runs helm lint and helm template on the workspace.
func Validate(ctx context.Context, chartDir string) (*ValidationResult, error) {
	result := &ValidationResult{}

	// Run helm lint
	lintOut, lintErr := runHelm(ctx, chartDir, "lint", ".")
	result.LintOutput = lintOut
	if lintErr != nil {
		result.LintPassed = false
		result.Errors = append(result.Errors, fmt.Sprintf("helm lint failed: %s", lintOut))
	} else {
		result.LintPassed = true
	}

	// Run helm template
	tmplOut, tmplErr := runHelm(ctx, chartDir, "template", "test-release", ".")
	result.TemplateOutput = tmplOut
	if tmplErr != nil {
		result.TemplatePassed = false
		result.Errors = append(result.Errors, fmt.Sprintf("helm template failed: %s", tmplOut))
	} else {
		result.TemplatePassed = true
	}

	return result, nil
}

// ValidateAndRetry runs validation; if it fails, sends errors back to the
// agent for a fix attempt. Returns the final validation result.
func ValidateAndRetry(ctx context.Context, a *Agent, chartDir string, maxRetries int) (*ValidationResult, error) {
	for i := 0; i <= maxRetries; i++ {
		result, err := Validate(ctx, chartDir)
		if err != nil {
			return nil, err
		}
		if result.IsValid() {
			return result, nil
		}
		if i == maxRetries {
			return result, nil
		}

		// Ask the agent to fix validation errors
		fixMsg := fmt.Sprintf(
			"The chart has validation errors. Please fix them:\n\n%s",
			strings.Join(result.Errors, "\n\n"),
		)
		_, err = a.Run(ctx, fixMsg)
		if err != nil {
			return result, fmt.Errorf("fix attempt %d failed: %w", i+1, err)
		}
	}

	// unreachable
	return nil, nil
}

// runHelm executes a helm subcommand and returns combined output.
func runHelm(ctx context.Context, dir string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "helm", args...)
	cmd.Dir = dir

	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	return out.String(), err
}
