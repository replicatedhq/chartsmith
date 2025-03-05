package diff

import (
	"fmt"
	"regexp"
	"strconv"
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
		return "", fmt.Errorf("invalid diff: too few lines")
	}

	// Keep the header lines
	cleanedLines := make([]string, 0, len(lines))
	cleanedLines = append(cleanedLines, lines[0], lines[1])

	// Keep track of line counts for reconstructing line numbers
	originalLineCount := 0
	modifiedLineCount := 0

	// First, validate the file headers
	if !strings.HasPrefix(lines[0], "--- ") || !strings.HasPrefix(lines[1], "+++ ") {
		return "", fmt.Errorf("invalid diff: missing file headers")
	}

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
				return "", fmt.Errorf("failed to reconstruct hunk: %w", err)
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

	return strings.Join(cleanedLines, "\n") + "\n", nil
}

func (d *DiffReconstructor) reconstructHunkHeader(hunkHeader string, remainingLines []string, originalLineCount, modifiedLineCount *int) (string, []string, error) {
	// Parse the original line numbers from the hunk header
	originalMatch := regexp.MustCompile(`@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$`).FindStringSubmatch(hunkHeader)
	if originalMatch == nil {
		return "", nil, fmt.Errorf("invalid hunk header format")
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

	// If we have original line counts in the hunk header, use them
	if originalMatch[2] != "" {
		sectionOriginalLines, _ = strconv.Atoi(originalMatch[2])
	}
	if originalMatch[4] != "" {
		sectionModifiedLines, _ = strconv.Atoi(originalMatch[4])
	}

	// Construct the new hunk header with line numbers
	newHunk := fmt.Sprintf("@@ -%s,%d +%s,%d @@%s",
		originalMatch[1],
		sectionOriginalLines,
		originalMatch[3],
		sectionModifiedLines,
		context)

	return newHunk, hunkLines, nil
}
