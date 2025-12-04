package helmutils

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/workspace/types"

	"github.com/pkg/errors"
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

// RenderChartExec executes helm commands to render a chart with the given files and values
// For backward compatibility, this function wraps RenderChartExecWithVersion with an empty version
func RenderChartExec(files []types.File, valuesYAML string, renderChannels RenderChannels) error {
	return RenderChartExecWithVersion(files, valuesYAML, renderChannels, "")
}

// RenderChartExecWithVersion executes helm commands with specific version to render a chart
// with the given files and values
func RenderChartExecWithVersion(files []types.File, valuesYAML string, renderChannels RenderChannels, helmVersion string) error {
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

	// Find the correct helm executable
	helmCmd, err := findExecutableForHelmVersion(helmVersion)
	if err != nil {
		renderChannels.Done <- errors.Wrap(err, "failed to find helm executable")
		return errors.Wrap(err, "failed to find helm executable")
	}

	// in order to avoid the special feature of helm where it detects the kubeconfig and uses that
	// when templating the chart, we put a completely fake kubeconfig in the env for this command
	fakeKubeconfig := `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://kubernetes.default
  name: default
`

	// Print the first Chart.yaml file for debugging
	foundChart := false
	var chartDir string
	for _, file := range files {
		if strings.HasSuffix(file.FilePath, "Chart.yaml") {
			foundChart = true
			renderChannels.DepUpdateStdout <- fmt.Sprintf("Found Chart.yaml at %s\n", file.FilePath)
			chartDir = filepath.Dir(file.FilePath)
			break
		}
	}

	if !foundChart {
		renderChannels.DepUpdateStdout <- "ERROR: No Chart.yaml file found in the provided files\n"
		renderChannels.Done <- errors.New("no Chart.yaml file found")
		return errors.New("no Chart.yaml file found")
	}

	renderChannels.DepUpdateStdout <- fmt.Sprintf("Using chart directory: %s\n", chartDir)

	rootDir, err := os.MkdirTemp("", "chartsmith")
	if err != nil {
		renderChannels.Done <- errors.Wrap(err, "failed to create temp dir")
		return errors.Wrap(err, "failed to create temp dir")
	}
	defer os.RemoveAll(rootDir)

	// Create fake kubeconfig file
	fakeKubeconfigPath := filepath.Join(rootDir, "fake-kubeconfig.yaml")
	if err := os.WriteFile(fakeKubeconfigPath, []byte(fakeKubeconfig), 0644); err != nil {
		renderChannels.Done <- errors.Wrap(err, "failed to create fake kubeconfig")
		return errors.Wrap(err, "failed to create fake kubeconfig")
	}

	for _, file := range files {
		fileRenderPath := filepath.Join(rootDir, file.FilePath)
		err := os.MkdirAll(filepath.Dir(fileRenderPath), 0755)
		if err != nil {
			renderChannels.Done <- errors.Wrapf(err, "failed to create dir %q", filepath.Dir(fileRenderPath))
			return errors.Wrapf(err, "failed to create dir %q", filepath.Dir(fileRenderPath))
		}

		err = os.WriteFile(fileRenderPath, []byte(file.Content), 0644)
		if err != nil {
			renderChannels.Done <- errors.Wrapf(err, "failed to write file %q", fileRenderPath)
			return errors.Wrapf(err, "failed to write file %q", fileRenderPath)
		}
	}

	// Working directory for Helm commands is the directory containing Chart.yaml
	workingDir := filepath.Join(rootDir, chartDir)

	// helm dependency update
	depUpdateCmd := exec.Command(helmCmd, "dependency", "update", ".")
	depUpdateCmd.Dir = workingDir
	depUpdateCmd.Env = []string{"KUBECONFIG=" + fakeKubeconfigPath}

	depUpdateStdoutReader, depUpdateStdoutWriter := io.Pipe()
	depUpdateStderrReader, depUpdateStderrWriter := io.Pipe()

	depUpdateCmd.Stdout = depUpdateStdoutWriter
	depUpdateCmd.Stderr = depUpdateStderrWriter

	helmDepUpdateExitCh := make(chan error, 1)

	// Copy helm dep update stdout to the stdout channel
	go func() {
		scanner := bufio.NewScanner(depUpdateStdoutReader)
		for scanner.Scan() {
			renderChannels.DepUpdateStdout <- scanner.Text() + "\n"
		}
	}()

	// Copy helm dep update stderr to the stdout channel
	go func() {
		scanner := bufio.NewScanner(depUpdateStderrReader)
		for scanner.Scan() {
			renderChannels.DepUpdateStdout <- scanner.Text() + "\n"
		}
	}()

	// Start the helm dep update process and wait for it to complete
	go func() {
		renderChannels.DepUpdateCmd <- depUpdateCmd.String()

		if err := depUpdateCmd.Start(); err != nil {
			helmDepUpdateExitCh <- errors.Wrap(err, "helm dependency update failed")
			return
		}

		// Create a context with timeout for the command
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		// Wait in a goroutine
		done := make(chan error, 1)
		go func() {
			done <- depUpdateCmd.Wait()
		}()

		// Wait for completion or timeout
		select {
		case err := <-done:
			if err != nil {
				helmDepUpdateExitCh <- errors.Wrap(err, "helm dependency update failed")
				return
			}
			helmDepUpdateExitCh <- nil
		case <-ctx.Done():
			// Attempt to kill the process if it times out
			depUpdateCmd.Process.Kill()
			helmDepUpdateExitCh <- errors.New("helm dependency update timed out after 5 minutes")
		}
	}()

	// Wait for the process to complete
	err = <-helmDepUpdateExitCh

	// Close the pipes
	depUpdateStdoutWriter.Close()
	depUpdateStderrWriter.Close()

	if err != nil {
		renderChannels.Done <- errors.Wrap(err, "failed to update dependencies")
		return errors.Wrap(err, "failed to update dependencies")
	}

	// helm template with values
	templateCmd := exec.Command(helmCmd, "template", "chartsmith", ".", "--include-crds", "--values", "/dev/stdin")
	templateCmd.Env = []string{"KUBECONFIG=" + fakeKubeconfigPath}
	templateCmd.Dir = workingDir

	if valuesYAML != "" {
		valuesFile := filepath.Join(workingDir, "values.yaml")
		if err := os.WriteFile(valuesFile, []byte(valuesYAML), 0644); err != nil {
			renderChannels.Done <- fmt.Errorf("failed to write values file: %w", err)
			return fmt.Errorf("failed to write values file: %w", err)
		}
		templateCmd.Args = append(templateCmd.Args, "-f", "values.yaml")
	}

	fmt.Printf("Running helm template with args: %v\n", templateCmd.Args)

	// Send command to the command channel
	renderChannels.HelmTemplateCmd <- templateCmd.String()

	// Create a context with timeout for the template command
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Create a channel to receive the command result
	cmdDone := make(chan struct {
		output []byte
		err    error
	}, 1)

	// Run the command with timeout in a goroutine
	go func() {
		output, err := templateCmd.CombinedOutput()
		cmdDone <- struct {
			output []byte
			err    error
		}{output, err}
	}()

	// Wait for completion or timeout
	var output []byte
	var cmdErr error

	select {
	case result := <-cmdDone:
		output = result.output
		cmdErr = result.err
	case <-ctx.Done():
		// Attempt to kill the process if it times out
		templateCmd.Process.Kill()
		renderChannels.HelmTemplateStderr <- "Helm template command timed out after 5 minutes\n"
		renderChannels.Done <- errors.New("helm template command timed out after 5 minutes")
		return errors.New("helm template command timed out after 5 minutes")
	}

	if cmdErr != nil {
		// Send the output to stderr channel before returning error
		errLines := bufio.NewScanner(bufio.NewReader(bytes.NewReader(output)))
		for errLines.Scan() {
			renderChannels.HelmTemplateStderr <- errLines.Text() + "\n"
		}
		renderChannels.Done <- fmt.Errorf("helm template command failed: %w", cmdErr)
		return fmt.Errorf("helm template command failed: %w", cmdErr)
	}

	bufferLineCount := 500
	buffer := make([]string, 0, bufferLineCount)
	// Process the captured output line by line
	lines := bufio.NewScanner(bufio.NewReader(bytes.NewReader(output)))
	var linesRead int
	for lines.Scan() {
		line := lines.Text()
		linesRead++
		buffer = append(buffer, line)
		if linesRead%bufferLineCount == 0 {
			// Send to stdout channel
			renderChannels.HelmTemplateStdout <- strings.Join(buffer, "\n")
			buffer = buffer[:0]
			linesRead = 0
		}
	}

	if err := lines.Err(); err != nil {
		renderChannels.Done <- fmt.Errorf("error reading helm template output: %w", err)
		return fmt.Errorf("error reading helm template output: %w", err)
	}

	// always send the last buffer
	renderChannels.HelmTemplateStdout <- strings.Join(buffer, "\n")

	// Send completion signal through Done channel
	renderChannels.Done <- nil

	return nil
}

// findExecutableForHelmVersion returns the path to the helm executable for the specified version
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
