package helmutils

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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

	// Clean up charts directory before dependency update to avoid partial downloads
	chartsDir := filepath.Join(dir, "charts")
	if _, err := os.Stat(chartsDir); err == nil {
		fmt.Printf("Cleaning up charts directory before dependency update...\n")
		os.RemoveAll(chartsDir)
	}

	// Update dependencies if Chart.yaml has dependencies
	fmt.Printf("Updating chart dependencies...\n")
	depUpdateCmd := exec.CommandContext(ctx, "helm", "dependency", "update", dir)
	depUpdateCmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfig)
	depUpdateOutput, depErr := depUpdateCmd.CombinedOutput()
	fmt.Printf("Helm dependency update output:\n%s\n", string(depUpdateOutput))
	
	// Check if dependency update failed with specific errors
	depUpdateOutputStr := string(depUpdateOutput)
	if depErr != nil {
		// Check for common dependency errors
		if strings.Contains(depUpdateOutputStr, "can't get a valid version") {
			return fmt.Errorf("chart dependency error: one or more dependencies have invalid versions that don't exist in their repositories\n\nPlease check Chart.yaml and either:\n1. Remove the dependencies section if you don't need external charts\n2. Update the version numbers to valid versions available in the repositories\n3. Remove specific dependencies that aren't needed\n\nDetails: %s", depUpdateOutputStr)
		}
		if strings.Contains(depUpdateOutputStr, "Chart.yaml file is missing") || strings.Contains(depUpdateOutputStr, "error unpacking subchart") {
			return fmt.Errorf("chart dependency error: failed to download or unpack one or more dependencies\n\nThis usually means:\n1. The dependency version doesn't exist in the repository\n2. The dependency repository URL is incorrect\n3. The dependency download was corrupted\n\nPlease check Chart.yaml and either:\n1. Remove the dependencies section if you don't need external charts\n2. Fix the dependency versions to valid versions that exist in the repositories\n3. Verify the repository URLs are correct\n\nDetails: %s", depUpdateOutputStr)
		}
		// For other errors, just warn but continue
		fmt.Printf("Warning: dependency update had issues (this is OK if chart has no dependencies): %v\n", depErr)
	}

	// SIMPLIFIED APPROACH: Package the chart first
	fmt.Printf("Packaging chart...\n")
	packageCmd := exec.CommandContext(ctx, "helm", "package", dir, "--destination", os.TempDir())
	packageCmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfig)
	packageOutput, err := packageCmd.CombinedOutput()
	fmt.Printf("Helm package output:\n%s\n", string(packageOutput))

	if err != nil {
		packageOutputStr := string(packageOutput)
		// Check for missing dependencies error
		if strings.Contains(packageOutputStr, "missing in charts/ directory") {
			return fmt.Errorf("chart packaging error: Chart.yaml lists dependencies that are missing from the charts/ directory\n\nThis usually means:\n1. The dependencies couldn't be downloaded (check versions in Chart.yaml)\n2. Custom local dependencies were specified but don't exist\n\nPlease either:\n1. Remove the dependencies section from Chart.yaml if you don't need them\n2. Fix the dependency versions to valid versions that exist in the repositories\n3. Provide the local chart files if using custom dependencies\n\nDetails: %s", packageOutputStr)
		}
		if strings.Contains(packageOutputStr, "Chart.yaml file is missing") || strings.Contains(packageOutputStr, "error unpacking subchart") {
			return fmt.Errorf("chart packaging error: one or more dependencies failed to download or are corrupted\n\nThis usually means:\n1. The dependency version doesn't exist in the repository\n2. The dependency download was incomplete or corrupted\n3. The dependency repository URL is incorrect\n\nPlease check Chart.yaml and either:\n1. Remove the dependencies section if you don't need external charts\n2. Fix the dependency versions to valid versions that exist in the repositories\n3. Verify the repository URLs are correct\n\nDetails: %s", packageOutputStr)
		}
		return fmt.Errorf("failed to package chart: %w\nOutput: %s", err, packageOutputStr)
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
