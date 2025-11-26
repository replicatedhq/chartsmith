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

	// Find the actual chart root directory (where Chart.yaml is located)
	chartDir := tempDir
	for _, file := range files {
		if filepath.Base(file.FilePath) == "Chart.yaml" {
			// Get the directory containing Chart.yaml
			chartDir = filepath.Join(tempDir, filepath.Dir(file.FilePath))
			// Handle case where FilePath is just "Chart.yaml" (dir would be ".")
			if filepath.Dir(file.FilePath) == "." {
				chartDir = tempDir
			}
			fmt.Printf("Found Chart.yaml at: %s, using chart directory: %s\n", file.FilePath, chartDir)
			break
		}
	}

	err = runHelmPublish(chartDir, workspaceID, chartName, fakeKubeconfig)
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

	// Build dependencies (if any) before packaging
	// This handles charts that have dependencies defined in Chart.yaml but missing in charts/
	fmt.Printf("Building dependencies...\n")
	depCmd := exec.CommandContext(ctx, "helm", "dependency", "build", dir)
	depCmd.Env = append(os.Environ(), "KUBECONFIG="+kubeconfig)
	depOutput, depErr := depCmd.CombinedOutput()
	if depErr != nil {
		// Just log the warning, don't fail - some charts might not need this or it might fail for other reasons
		// If package fails later, it will be caught then
		fmt.Printf("Warning: helm dependency build failed: %v\nOutput: %s\n", depErr, string(depOutput))
	} else {
		fmt.Printf("Helm dependency build output:\n%s\n", string(depOutput))
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
	// OCI registries require lowercase repository names
	chartTag := fmt.Sprintf("chartsmith-%s", strings.ToLower(workspaceID))
	fmt.Printf("Using chart tag: %s\n", chartTag)

	// Update remote to use the namespaced URL
	remoteWithNamespace := fmt.Sprintf("%s/%s", remote, chartTag)
	fmt.Printf("  Remote URL with namespace: %s\n", remoteWithNamespace)

	// DIRECT PUSH: Use a single, reliable approach with helm push
	fmt.Printf("Pushing chart to ttl.sh...\n")

	// Try direct push to the namespaced ttl.sh
	// Add --insecure-skip-tls-verify to avoid macOS keychain/TLS issues that cause hanging
	pushCmd := exec.CommandContext(ctx, "helm", "push", chartPackage, remoteWithNamespace, "--insecure-skip-tls-verify")
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
