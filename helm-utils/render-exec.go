package helmutils

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type RenderChannels struct {
	DepUpdateCmd       chan string
	DepUpdateStderr    chan string
	DepUpdateStdout    chan string
	HelmTemplateCmd    chan string
	HelmTemplateStderr chan string
	HelmTemplateStdout chan string

	Done chan error
}

func RenderChartExec(files []types.File, valuesYAML string, renderChannels RenderChannels) error {
	start := time.Now()
	defer func() {
		fmt.Printf("RenderChartExec completed in %v\n", time.Since(start))

		// Add capture for panic recovery
		if r := recover(); r != nil {
			fmt.Printf("PANIC in RenderChartExec: %v\n", r)
			// Try to send error through the channel if it's still open
			select {
			case renderChannels.Done <- fmt.Errorf("panic in helm render: %v", r):
				// Error sent successfully
			default:
				// Channel might be closed or unbuffered and no receiver
				fmt.Printf("WARNING: Could not send panic through Done channel\n")
			}
		}
	}()
	// in order to avoid the special feature of helm where it detects the kubeconfig and uses that
	// when templating the chart, we put a completely fake kubeconfig in the env for this command
	fakeKubeconfig := `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://kubernetes.default
  name: default
`

	// create a temp dir and copy the files into it
	fmt.Printf("Creating temp directory for chart files\n")
	tempDir, err := os.MkdirTemp("", "chartsmith")
	if err != nil {
		fmt.Printf("ERROR: Failed to create temp dir: %v\n", err)
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	fmt.Printf("Created temp directory at: %s\n", tempDir)
	defer os.RemoveAll(tempDir)

	fmt.Printf("Copying %d files to the temp directory\n", len(files))
	for _, file := range files {
		filePath := filepath.Join(tempDir, file.FilePath)
		// ensure the directory exists
		dir := filepath.Dir(filePath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			fmt.Printf("ERROR: Failed to create directory %s: %v\n", dir, err)
			return fmt.Errorf("failed to create directory: %w", err)
		}

		if err := os.WriteFile(filePath, []byte(file.Content), 0644); err != nil {
			fmt.Printf("ERROR: Failed to write file %s: %v\n", filePath, err)
			return fmt.Errorf("failed to write file: %w", err)
		}
	}
	fmt.Printf("Successfully copied all files to temp directory\n")

	fmt.Printf("Starting helm dependency update...\n")
	err = runHelmDepUpdate(tempDir, fakeKubeconfig, renderChannels.DepUpdateCmd, renderChannels.DepUpdateStdout, renderChannels.DepUpdateStderr)
	if err != nil {
		fmt.Printf("ERROR: Helm dependency update failed: %v\n", err)
		renderChannels.Done <- err
		return err
	}
	fmt.Printf("Helm dependency update completed successfully\n")

	fmt.Printf("Starting helm template...\n")
	err = runHelmTemplate(tempDir, valuesYAML, fakeKubeconfig, renderChannels.HelmTemplateCmd, renderChannels.HelmTemplateStdout, renderChannels.HelmTemplateStderr)
	if err != nil {
		fmt.Printf("ERROR: Helm template failed: %v\n", err)
		renderChannels.Done <- err
		return err
	}
	fmt.Printf("Helm template completed successfully\n")

	fmt.Printf("Sending completion signal through Done channel\n")
	renderChannels.Done <- nil
	fmt.Printf("Completed rendering chart successfully\n")

	return nil
}

func findExecutableForHelmVersion(helmVersion string) (string, error) {
	if helmVersion == "" {
		return "helm", nil
	}

	// Check for specific version
	versionedPath := fmt.Sprintf("/usr/local/bin/helm-%s", helmVersion)
	if _, err := exec.LookPath(versionedPath); err == nil {
		return versionedPath, nil
	}

	return "", fmt.Errorf("unsupported helm version: %s", helmVersion)
}

func runHelmDepUpdate(dir string, kubeconfig string, cmdCh chan string, stdoutCh chan string, stderrCh chan string) error {
	fmt.Printf("Running helm dep update in %s\n", dir)

	// Add timeout to avoid hanging commands
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	depUpdateCmd := exec.CommandContext(ctx, "helm", "dep", "update")
	depUpdateCmd.Env = []string{"KUBECONFIG=" + kubeconfig}
	depUpdateCmd.Dir = dir

	cmdCh <- depUpdateCmd.String()

	// Use CombinedOutput instead of pipes for reliable output capture
	output, err := depUpdateCmd.CombinedOutput()
	if err != nil {
		// Send the output to stderr channel before returning error
		errLines := bufio.NewScanner(bufio.NewReader(bytes.NewReader(output)))
		for errLines.Scan() {
			stderrCh <- errLines.Text() + "\n"
		}
		return fmt.Errorf("helm dep update command failed: %w", err)
	}

	// Process the captured output line by line
	lines := bufio.NewScanner(bufio.NewReader(bytes.NewReader(output)))
	for lines.Scan() {
		line := lines.Text()
		// Send to stdout channel
		stdoutCh <- line + "\n"
	}

	if err := lines.Err(); err != nil {
		return fmt.Errorf("error reading helm dep update output: %w", err)
	}

	return nil
}

func runHelmTemplate(dir string, valuesYAML string, kubeconfig string, cmdCh chan string, stdoutCh chan string, stderrCh chan string) error {
	fmt.Printf("Running helm template in %s\n", dir)

	// Add timeout to avoid hanging commands
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	args := []string{"template", "chartsmith", "."}
	if valuesYAML != "" {
		valuesFile := filepath.Join(dir, "values.yaml")
		if err := os.WriteFile(valuesFile, []byte(valuesYAML), 0644); err != nil {
			return fmt.Errorf("failed to write values file: %w", err)
		}
		args = append(args, "-f", "values.yaml")
	}

	fmt.Printf("Running helm template with args: %v\n", args)

	// Use CombinedOutput instead of pipes for reliable output capture
	cmd := exec.CommandContext(ctx, "helm", args...)
	cmd.Env = []string{"KUBECONFIG=" + kubeconfig}
	cmd.Dir = dir

	cmdCh <- cmd.String()

	// Capture all output at once, which avoids the pipe closure issue
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Send the output to stderr channel before returning error
		errLines := bufio.NewScanner(bufio.NewReader(bytes.NewReader(output)))
		for errLines.Scan() {
			stderrCh <- errLines.Text() + "\n"
		}
		return fmt.Errorf("helm template command failed: %w", err)
	}

	bufferLineCount := 500
	buffer := make([]string, 0, bufferLineCount)
	// Process the captured output line by line
	// let 20 lines pass before sending to the
	lines := bufio.NewScanner(bufio.NewReader(bytes.NewReader(output)))
	var linesRead int
	for lines.Scan() {
		line := lines.Text()
		linesRead++
		buffer = append(buffer, line)
		if linesRead%bufferLineCount == 0 {
			// Send to stdout channel
			stdoutCh <- strings.Join(buffer, "\n")
			buffer = buffer[:0]
			linesRead = 0
		}
	}

	if err := lines.Err(); err != nil {
		return fmt.Errorf("error reading helm template output: %w", err)
	}

	// always send the last buffer
	stdoutCh <- strings.Join(buffer, "\n")

	return nil
}
