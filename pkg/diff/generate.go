package diff

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// generatePatch creates a unified diff between original and modified content using the standard diff tool
func GeneratePatch(originalContent, modifiedContent, filename string) (string, error) {
	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "chartsmith-diff")
	if err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Create original and modified files
	originalFile := filepath.Join(tempDir, "original")
	modifiedFile := filepath.Join(tempDir, "modified")

	if err := os.WriteFile(originalFile, []byte(originalContent), 0644); err != nil {
		return "", fmt.Errorf("failed to write original file: %w", err)
	}

	if err := os.WriteFile(modifiedFile, []byte(modifiedContent), 0644); err != nil {
		return "", fmt.Errorf("failed to write modified file: %w", err)
	}

	// Run diff command
	cmd := exec.Command("diff", "-u", "--label", filename, "--label", filename, originalFile, modifiedFile)
	output, err := cmd.Output()

	// diff returns non-zero exit code if files differ, which is expected
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			// Exit code 1 means files are different, which is what we want
			return string(output), nil
		}
		return "", fmt.Errorf("failed to run diff command: %w", err)
	}

	return string(output), nil
}
