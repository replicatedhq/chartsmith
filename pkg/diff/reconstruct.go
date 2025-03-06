package diff

import (
	"fmt"
	"regexp"
	"strings"
)

type DiffReconstructor struct {
	originalContent string
	diffContent     string
}

func NewDiffReconstructor(originalContent, diffContent string) *DiffReconstructor {
	return &DiffReconstructor{
		originalContent: originalContent,
		diffContent:     diffContent,
	}
}

// ReconstructDiff takes a diff that may have incorrect line numbers and fixes them
// based on the original content and the changes in the diff
func (d *DiffReconstructor) ReconstructDiff() (string, error) {
	lines := strings.Split(strings.TrimSpace(d.diffContent), "\n")
	if len(lines) < 4 {
		return "", fmt.Errorf("invalid diff: too few lines (got %d, need at least 4)", len(lines))
	}

	// Keep the header lines
	cleanedLines := make([]string, 0, len(lines))

	// Validate and clean up file headers
	if !strings.HasPrefix(lines[0], "--- ") {
		return "", fmt.Errorf("invalid diff: first line must start with '--- ' (got %q)", lines[0])
	}
	if !strings.HasPrefix(lines[1], "+++ ") {
		return "", fmt.Errorf("invalid diff: second line must start with '+++ ' (got %q)", lines[1])
	}

	cleanedLines = append(cleanedLines, lines[0], lines[1])

	// Keep track of line counts for reconstructing line numbers
	originalLineCount := 0
	modifiedLineCount := 0

	var currentHunkLines []string
	for i := 2; i < len(lines); i++ {
		line := lines[i]

		if strings.HasPrefix(line, "@@") {
			// If we have a previous hunk, add it to cleanedLines
			if len(currentHunkLines) > 0 {
				cleanedLines = append(cleanedLines, currentHunkLines...)
			}
			currentHunkLines = nil

			hunk, nextLines, err := d.reconstructHunkHeader(line, lines[i:], &originalLineCount, &modifiedLineCount)
			if err != nil {
				// Add more context to the error
				return "", fmt.Errorf("failed to reconstruct hunk at line %d: %w (line: %q)", i, err, line)
			}
			currentHunkLines = append(currentHunkLines, hunk)
			currentHunkLines = append(currentHunkLines, nextLines...)
			i += len(nextLines) - 1 // Skip the lines we've processed
			continue
		}
		if currentHunkLines == nil {
			cleanedLines = append(cleanedLines, line)
		}
	}

	// Add the final hunk if there is one
	if len(currentHunkLines) > 0 {
		cleanedLines = append(cleanedLines, currentHunkLines...)
	}

	result := strings.Join(cleanedLines, "\n") + "\n"

	// Validate the final diff
	if !strings.HasPrefix(result, "--- ") || !strings.Contains(result, "\n+++ ") {
		return "", fmt.Errorf("invalid final diff format: missing file headers")
	}

	return result, nil
}

func (d *DiffReconstructor) reconstructHunkHeader(hunkHeader string, remainingLines []string, originalLineCount, modifiedLineCount *int) (string, []string, error) {
	// Update regex to make line numbers optional
	originalMatch := regexp.MustCompile(`@@ -(\d+)?(?:,(\d+))? \+(\d+)?(?:,(\d+))? @@(.*)$`).FindStringSubmatch(hunkHeader)
	if originalMatch == nil {
		// Add more detailed error message
		return "", nil, fmt.Errorf("invalid hunk header format: %q", hunkHeader)
	}

	// Default to line 1 if no line numbers provided
	startLine := "1"
	if originalMatch[1] != "" {
		startLine = originalMatch[1]
	}

	// Extract context preserving whitespace
	context := originalMatch[5]

	// Count the changes in this section and collect lines
	var hunkLines []string
	sectionOriginalLines := 0
	sectionModifiedLines := 0

	// Skip the hunk header
	for i := 1; i < len(remainingLines); i++ {
		line := remainingLines[i]
		if strings.HasPrefix(line, "@@") {
			break
		}

		hunkLines = append(hunkLines, line)
		if strings.HasPrefix(line, "-") {
			sectionOriginalLines++
		} else if strings.HasPrefix(line, "+") {
			sectionModifiedLines++
		} else if !strings.HasPrefix(line, "\\") { // Ignore "\ No newline" markers
			sectionOriginalLines++
			sectionModifiedLines++
		}
	}

	// If we have no changes, this is probably an invalid hunk
	if sectionOriginalLines == 0 && sectionModifiedLines == 0 {
		return "", nil, fmt.Errorf("hunk contains no changes")
	}

	// Construct the new hunk header with line numbers
	newHunk := fmt.Sprintf("@@ -%s,%d +%s,%d @@%s",
		startLine,
		sectionOriginalLines,
		startLine,
		sectionModifiedLines,
		context)

	return newHunk, hunkLines, nil
}
