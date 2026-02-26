package agent

import (
	"crypto/sha256"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// workspace.go manages the temporary workspace for agent runs.
//
// Before an agent runs, we snapshot the chart files into a temp directory.
// After the agent finishes, we diff against the snapshot to find what changed.
// This replaces the workspace management scattered across pkg/llm/.

// Workspace represents a temporary working directory for an agent run.
type Workspace struct {
	// Dir is the workspace root directory.
	Dir string

	// snapshot stores file hashes taken before the agent runs.
	snapshot map[string]string

	// managed is true if we created the directory (and should clean it up).
	managed bool
}

// NewWorkspace creates a workspace from existing chart files.
// srcDir contains the chart files to copy into the workspace.
func NewWorkspace(srcDir string) (*Workspace, error) {
	tmpDir, err := os.MkdirTemp("", "chartsmith-agent-*")
	if err != nil {
		return nil, fmt.Errorf("creating temp dir: %w", err)
	}

	// Copy chart files into workspace
	if err := copyDir(srcDir, tmpDir); err != nil {
		os.RemoveAll(tmpDir)
		return nil, fmt.Errorf("copying chart files: %w", err)
	}

	ws := &Workspace{
		Dir:     tmpDir,
		managed: true,
	}

	// Take initial snapshot for diff detection
	ws.snapshot, err = hashDir(tmpDir)
	if err != nil {
		os.RemoveAll(tmpDir)
		return nil, fmt.Errorf("snapshotting workspace: %w", err)
	}

	return ws, nil
}

// WrapExisting wraps an existing directory as a workspace (no copy).
func WrapExisting(dir string) (*Workspace, error) {
	snapshot, err := hashDir(dir)
	if err != nil {
		return nil, fmt.Errorf("snapshotting workspace: %w", err)
	}

	return &Workspace{
		Dir:      dir,
		snapshot: snapshot,
		managed:  false,
	}, nil
}

// ModifiedFiles returns files that changed since the workspace was created.
func (w *Workspace) ModifiedFiles() ([]string, error) {
	current, err := hashDir(w.Dir)
	if err != nil {
		return nil, fmt.Errorf("scanning workspace: %w", err)
	}

	var modified []string

	// Check for changed or new files
	for path, hash := range current {
		if oldHash, exists := w.snapshot[path]; !exists || oldHash != hash {
			modified = append(modified, path)
		}
	}

	return modified, nil
}

// Cleanup removes the workspace if it was created by us.
func (w *Workspace) Cleanup() error {
	if w.managed {
		return os.RemoveAll(w.Dir)
	}
	return nil
}

// ReadFile reads a file from the workspace, returning its contents.
func (w *Workspace) ReadFile(relPath string) (string, error) {
	// Prevent path traversal
	cleaned := filepath.Clean(relPath)
	if strings.HasPrefix(cleaned, "..") {
		return "", fmt.Errorf("path traversal not allowed: %s", relPath)
	}

	data, err := os.ReadFile(filepath.Join(w.Dir, cleaned))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// hashDir creates a map of relative path → SHA256 hash for all files.
func hashDir(dir string) (map[string]string, error) {
	hashes := make(map[string]string)

	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			// Skip hidden directories (.git, etc.)
			if strings.HasPrefix(d.Name(), ".") && d.Name() != "." {
				return filepath.SkipDir
			}
			return nil
		}

		relPath, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		hash := sha256.Sum256(data)
		hashes[relPath] = fmt.Sprintf("%x", hash)
		return nil
	})

	return hashes, err
}

// copyDir recursively copies src to dst.
func copyDir(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip .git
		if d.IsDir() && d.Name() == ".git" {
			return filepath.SkipDir
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		dstPath := filepath.Join(dst, relPath)

		if d.IsDir() {
			return os.MkdirAll(dstPath, 0o755)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(dstPath, data, 0o644)
	})
}
