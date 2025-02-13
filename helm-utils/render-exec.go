package helmutils

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

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
	tempDir, err := os.MkdirTemp("", "chartsmith")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	for _, file := range files {
		filePath := filepath.Join(tempDir, file.FilePath)
		// ensure the directory exists
		dir := filepath.Dir(filePath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory: %w", err)
		}
		if err := os.WriteFile(filePath, []byte(file.Content), 0644); err != nil {
			return fmt.Errorf("failed to write file: %w", err)
		}
	}

	err = runHelmDepUpdate(tempDir, fakeKubeconfig, renderChannels.DepUpdateCmd, renderChannels.DepUpdateStdout, renderChannels.DepUpdateStderr)
	if err != nil {
		return fmt.Errorf("failed to run helm dep update: %w", err)
	}

	err = runHelmTemplate(tempDir, valuesYAML, fakeKubeconfig, renderChannels.HelmTemplateCmd, renderChannels.HelmTemplateStdout, renderChannels.HelmTemplateStderr)
	if err != nil {
		return fmt.Errorf("failed to run helm template: %w", err)
	}

	renderChannels.Done <- nil

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

	depUpdateCmd := exec.Command("helm", "dep", "update")
	depUpdateCmd.Env = []string{"KUBECONFIG=" + kubeconfig}
	depUpdateCmd.Dir = dir

	cmdCh <- depUpdateCmd.String()
	stdout, err := depUpdateCmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := depUpdateCmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := depUpdateCmd.Start(); err != nil {
		return fmt.Errorf("failed to start helm dep update: %w", err)
	}

	// Start goroutines to stream output
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			stdoutCh <- scanner.Text() + "\n"
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			stderrCh <- scanner.Text() + "\n"
		}
	}()

	// Wait for command to complete
	if err := depUpdateCmd.Wait(); err != nil {
		return fmt.Errorf("failed to run helm dep update: %w", err)
	}

	return nil
}

func runHelmTemplate(dir string, valuesYAML string, kubeconfig string, cmdCh chan string, stdoutCh chan string, stderrCh chan string) error {
	fmt.Printf("Running helm template in %s\n", dir)

	args := []string{"template", "chartsmith", "."}
	if valuesYAML != "" {
		valuesFile := filepath.Join(dir, "values.yaml")
		if err := os.WriteFile(valuesFile, []byte(valuesYAML), 0644); err != nil {
			return fmt.Errorf("failed to write values file: %w", err)
		}
		args = append(args, "-f", "values.yaml")
	}

	cmd := exec.Command("helm", args...)
	cmd.Env = []string{"KUBECONFIG=" + kubeconfig}
	cmd.Dir = dir

	cmdCh <- cmd.String()

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start helm template: %w", err)
	}

	// Start goroutines to stream output
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			stdoutCh <- scanner.Text() + "\n"
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			stderrCh <- scanner.Text() + "\n"
		}
	}()

	// Wait for command to complete
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("failed to run helm template: %w", err)
	}

	return nil
}
