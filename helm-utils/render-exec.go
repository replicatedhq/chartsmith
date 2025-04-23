package helmutils

import (
	"bufio"
	"bytes"
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
	_ = `apiVersion: v1
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
		return errors.New("no Chart.yaml file found")
	}

	renderChannels.DepUpdateStdout <- fmt.Sprintf("Using chart directory: %s\n", chartDir)

	rootDir, err := os.MkdirTemp("", "chartsmith")
	if err != nil {
		return errors.Wrap(err, "failed to create temp dir")
	}
	defer os.RemoveAll(rootDir)

	for _, file := range files {
		fileRenderPath := filepath.Join(rootDir, file.FilePath)
		err := os.MkdirAll(filepath.Dir(fileRenderPath), 0755)
		if err != nil {
			return errors.Wrapf(err, "failed to create dir %q", filepath.Dir(fileRenderPath))
		}

		err = os.WriteFile(fileRenderPath, []byte(file.Content), 0644)
		if err != nil {
			return errors.Wrapf(err, "failed to write file %q", fileRenderPath)
		}
	}

	// Working directory for Helm commands is the directory containing Chart.yaml
	workingDir := filepath.Join(rootDir, chartDir)

	// helm dependency update
	depUpdateCmd := exec.Command("helm", "dependency", "update", ".")
	depUpdateCmd.Dir = workingDir

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
		if err := depUpdateCmd.Start(); err != nil {
			helmDepUpdateExitCh <- errors.Wrap(err, "helm dependency update failed")
			return
		}

		err := depUpdateCmd.Wait()
		if err != nil {
			helmDepUpdateExitCh <- errors.Wrap(err, "helm dependency update failed")
			return
		}

		helmDepUpdateExitCh <- nil
	}()

	// Wait for the process to complete
	err = <-helmDepUpdateExitCh

	// Close the pipes
	depUpdateStdoutWriter.Close()
	depUpdateStderrWriter.Close()

	if err != nil {
		return errors.Wrap(err, "failed to update dependencies")
	}

	// helm template with values
	templateCmd := exec.Command("helm", "template", ".", "--include-crds", "--values", "/dev/stdin")

	if valuesYAML != "" {
		valuesFile := filepath.Join(workingDir, "values.yaml")
		if err := os.WriteFile(valuesFile, []byte(valuesYAML), 0644); err != nil {
			return fmt.Errorf("failed to write values file: %w", err)
		}
		templateCmd.Args = append(templateCmd.Args, "-f", "values.yaml")
	}

	fmt.Printf("Running helm template with args: %v\n", templateCmd.Args)

	// Use CombinedOutput instead of pipes for reliable output capture
	templateCmd.Env = []string{"KUBECONFIG=/dev/null"}
	templateCmd.Dir = workingDir

	renderChannels.HelmTemplateCmd <- templateCmd.String()

	// Capture all output at once, which avoids the pipe closure issue
	output, err := templateCmd.CombinedOutput()
	if err != nil {
		// Send the output to stderr channel before returning error
		errLines := bufio.NewScanner(bufio.NewReader(bytes.NewReader(output)))
		for errLines.Scan() {
			renderChannels.HelmTemplateStderr <- errLines.Text() + "\n"
		}
		return fmt.Errorf("helm template command failed: %w", err)
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
		return fmt.Errorf("error reading helm template output: %w", err)
	}

	// always send the last buffer
	renderChannels.HelmTemplateStdout <- strings.Join(buffer, "\n")

	return nil
}
