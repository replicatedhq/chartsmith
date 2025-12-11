package helmutils

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func PublishChartExec(files []types.File, workspaceID string, chartName string) error {
	fakeKubeconfig := `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://kubernetes.default
  name: default
`

	tempDir, err := os.MkdirTemp("", "chartsmith")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	for _, file := range files {
		filePath := filepath.Join(tempDir, file.FilePath)
		if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
			return fmt.Errorf("failed to create directory: %w", err)
		}

		// Write file content
		if err := os.WriteFile(filePath, []byte(file.Content), 0644); err != nil {
			return fmt.Errorf("failed to write file %s: %w", file.FilePath, err)
		}
	}

	err = runHelmPublish(tempDir, workspaceID, chartName, fakeKubeconfig)
	if err != nil {
		return fmt.Errorf("failed to run helm publish: %w", err)
	}

	return nil
}

func runHelmPublish(dir string, workspaceID string, chartName string, kubeconfig string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Print start message with key details
	fmt.Printf("Starting helm publish:\n")
	fmt.Printf("  Working directory: %s\n", dir)
	fmt.Printf("  Workspace ID: %s\n", workspaceID)
	fmt.Printf("  Chart name: %s\n", chartName)

	remote := "oci://ttl.sh"
	fmt.Printf("  Remote URL: %s\n", remote)

	// List directory contents for debugging
	lsCmd := exec.Command("ls", "-la", dir)
	lsOutput, _ := lsCmd.CombinedOutput()
	fmt.Printf("Directory contents:\n%s\n", string(lsOutput))

	// Log helm version
	versionCmd := exec.CommandContext(ctx, "helm", "version")
	versionOutput, _ := versionCmd.CombinedOutput()
	fmt.Printf("Helm version:\n%s\n", string(versionOutput))

	// Update dependencies first
	fmt.Printf("Updating helm dependencies...\n")
	depUpdateCmd := exec.CommandContext(ctx, "helm", "dependency", "update", dir)
	depUpdateCmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfig)
	depUpdateOutput, err := depUpdateCmd.CombinedOutput()
	fmt.Printf("Helm dependency update output:\n%s\n", string(depUpdateOutput))
	if err != nil {
		return fmt.Errorf("failed to update dependencies: %w\nOutput: %s", err, string(depUpdateOutput))
	}

	// SIMPLIFIED APPROACH: Package the chart first
	fmt.Printf("Packaging chart...\n")
	packageCmd := exec.CommandContext(ctx, "helm", "package", dir, "--destination", os.TempDir())
	packageCmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfig)
	packageOutput, err := packageCmd.CombinedOutput()
	fmt.Printf("Helm package output:\n%s\n", string(packageOutput))

	if err != nil {
		return fmt.Errorf("failed to package chart: %w\nOutput: %s", err, string(packageOutput))
	}

	// Find the newly created package file
	packagePattern := filepath.Join(os.TempDir(), fmt.Sprintf("%s-*.tgz", chartName))
	matches, err := filepath.Glob(packagePattern)
	if err != nil {
		return fmt.Errorf("failed to find package: %w", err)
	}

	if len(matches) == 0 {
		return fmt.Errorf("no chart package found matching %s", packagePattern)
	}

	chartPackage := matches[0] // Use the first match
	fmt.Printf("Using chart package: %s\n", chartPackage)

	// Tag the chart with the workspace ID to make it uniquely identifiable
	chartTag := fmt.Sprintf("chartsmith-%s", workspaceID)
	fmt.Printf("Using chart tag: %s\n", chartTag)

	// DIRECT PUSH: Use a single, reliable approach with helm push
	fmt.Printf("Pushing chart to ttl.sh...\n")

	// Try direct push to the root of ttl.sh
	pushCmd := exec.CommandContext(ctx, "helm", "push", chartPackage, remote)
	pushCmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfig)
	pushOutput, pushErr := pushCmd.CombinedOutput()
	if pushErr != nil {
		return fmt.Errorf("failed to push chart: %w\nOutput: %s", pushErr, string(pushOutput))
	}

	// Log output regardless of success/failure
	fmt.Printf("Helm push output:\n%s\n", string(pushOutput))

	fmt.Printf("Helm push completed successfully\n")
	return nil
}
