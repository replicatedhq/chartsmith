package integration

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func IntegrationTestChart_ChooseRelevantFilesForChatMessage() (map[string]string, error) {
	archive := filepath.Join("testdata", "charts", "okteto-1.29.0-rc.2.tgz")

	// confirm that the file exists
	if _, err := os.Stat(archive); os.IsNotExist(err) {
		return nil, fmt.Errorf("test data archive not found: %w", err)
	}

	// untar gz this archive
	file, err := os.Open(archive)
	if err != nil {
		return nil, fmt.Errorf("failed to open archive: %w", err)
	}
	defer file.Close()

	gzr, err := gzip.NewReader(file)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)
	files := make(map[string]string)

	// First collect all paths to find common prefix
	var paths []string
	fileContents := make(map[string]string)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading tar: %w", err)
		}

		// Skip if not a regular file
		if header.Typeflag != tar.TypeReg {
			continue
		}

		// remove subcharts
		if strings.Contains(header.Name, "/charts/") {
			continue
		}

		// Read the file contents
		contents := make([]byte, header.Size)
		if _, err := io.ReadFull(tr, contents); err != nil {
			return nil, fmt.Errorf("error reading file contents: %w", err)
		}

		paths = append(paths, header.Name)
		fileContents[header.Name] = string(contents)
	}

	// Find common prefix
	if len(paths) > 0 {
		prefix := paths[0]
		for _, path := range paths[1:] {
			for i := 0; i < len(prefix) && i < len(path); i++ {
				if prefix[i] != path[i] {
					prefix = prefix[:i]
					break
				}
			}
		}

		// Add files with trimmed prefix
		for path, content := range fileContents {
			trimmedPath := strings.TrimPrefix(path, prefix)
			// Remove leading slash if present after trimming
			trimmedPath = strings.TrimPrefix(trimmedPath, "/")
			files[trimmedPath] = content
		}
	}

	return files, nil
}
