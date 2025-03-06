package diff

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

type hunk struct {
	header        string
	content       []string
	originalStart int
	originalCount int
	modifiedStart int
	modifiedCount int
	contextBefore []string
	contextAfter  []string
}

type DiffReconstructor struct {
	originalContent string
	diffContent     string
}

func NewDiffReconstructor(originalContent, diffContent string) *DiffReconstructor {
	return &DiffReconstructor{
		originalContent: normalizeLineEndings(originalContent),
		diffContent:     normalizeLineEndings(diffContent),
	}
}

func normalizeLineEndings(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "\r\n", "\n"), "\r", "\n")
}

func (d *DiffReconstructor) ReconstructDiff() (string, error) {
	lines := strings.Split(strings.TrimSpace(d.diffContent), "\n")
	if len(lines) < 4 {
		return "", fmt.Errorf("invalid diff: too few lines (got %d, need at least 4)", len(lines))
	}

	// Find first valid header pair
	origFile, _, startIdx := d.findFirstValidHeaders(lines)
	if startIdx == -1 {
		return "", fmt.Errorf("no valid diff headers found")
	}

	// Parse all hunks
	hunks, err := d.parseHunks(lines[startIdx:])
	if err != nil {
		return "", fmt.Errorf("failed to parse hunks: %w", err)
	}

	// Combine overlapping or adjacent hunks
	hunks = d.combineHunks(hunks)

	// Build the final diff
	var result strings.Builder
	basePath := filepath.Base(origFile)

	// Check if we should preserve the original path format
	if strings.Contains(d.diffContent, "--- Chart.yaml") {
		result.WriteString(fmt.Sprintf("--- %s\n", basePath))
		result.WriteString(fmt.Sprintf("+++ %s\n", basePath))
	} else {
		result.WriteString(fmt.Sprintf("--- a/%s\n", basePath))
		result.WriteString(fmt.Sprintf("+++ b/%s\n", basePath))
	}

	// Write hunks
	for _, h := range hunks {
		result.WriteString(h.header + "\n")
		for _, line := range h.content {
			result.WriteString(line + "\n")
		}
	}

	return result.String(), nil
}

func (d *DiffReconstructor) findFirstValidHeaders(lines []string) (string, string, int) {
	for i := 0; i < len(lines)-1; i++ {
		if strings.HasPrefix(strings.TrimSpace(lines[i]), "--- ") &&
			strings.HasPrefix(strings.TrimSpace(lines[i+1]), "+++ ") {
			return strings.TrimPrefix(strings.TrimSpace(lines[i]), "--- "),
				strings.TrimPrefix(strings.TrimSpace(lines[i+1]), "+++ "),
				i + 2
		}
	}
	return "", "", -1
}

func (d *DiffReconstructor) parseHunks(lines []string) ([]hunk, error) {
	var hunks []hunk
	var currentHunk *hunk

	originalLines := strings.Split(d.originalContent, "\n")

	for i := 0; i < len(lines); i++ {
		line := strings.TrimRight(lines[i], "\r\n")

		if strings.HasPrefix(line, "@@ ") {
			if currentHunk != nil {
				// Calculate actual counts based on content
				addCount, removeCount := 0, 0
				for _, l := range currentHunk.content {
					if strings.HasPrefix(l, "+") {
						addCount++
					} else if strings.HasPrefix(l, "-") {
						removeCount++
					}
				}
				currentHunk.originalCount = removeCount + len(currentHunk.content) - addCount - removeCount
				currentHunk.modifiedCount = addCount + len(currentHunk.content) - addCount - removeCount
				currentHunk.header = fmt.Sprintf("@@ -%d,%d +%d,%d @@",
					currentHunk.originalStart, currentHunk.originalCount,
					currentHunk.modifiedStart, currentHunk.modifiedCount)
				hunks = append(hunks, *currentHunk)
			}

			h, err := d.parseHunkHeader(line, originalLines)
			if err != nil {
				return nil, err
			}
			currentHunk = h
			continue
		}

		if currentHunk != nil && !strings.HasPrefix(line, "---") && !strings.HasPrefix(line, "+++") {
			currentHunk.content = append(currentHunk.content, line)
		}
	}

	if currentHunk != nil {
		// Calculate actual counts for last hunk
		addCount, removeCount := 0, 0
		for _, l := range currentHunk.content {
			if strings.HasPrefix(l, "+") {
				addCount++
			} else if strings.HasPrefix(l, "-") {
				removeCount++
			}
		}
		currentHunk.originalCount = removeCount + len(currentHunk.content) - addCount - removeCount
		currentHunk.modifiedCount = addCount + len(currentHunk.content) - addCount - removeCount
		currentHunk.header = fmt.Sprintf("@@ -%d,%d +%d,%d @@",
			currentHunk.originalStart, currentHunk.originalCount,
			currentHunk.modifiedStart, currentHunk.modifiedCount)
		hunks = append(hunks, *currentHunk)
	}

	return hunks, nil
}

func (d *DiffReconstructor) parseHunkHeader(header string, originalLines []string) (*hunk, error) {
	// Parse "@@ -a,b +c,d @@" format
	parts := strings.Split(header, " ")
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid hunk header format: %s", header)
	}

	original := strings.TrimPrefix(parts[1], "-")
	modified := strings.TrimPrefix(parts[2], "+")

	originalStart, originalCount := parseHunkRange(original)
	modifiedStart, modifiedCount := parseHunkRange(modified)

	// Validate and adjust line numbers
	if originalStart <= 0 {
		originalStart = 1
	}
	if modifiedStart <= 0 {
		modifiedStart = 1
	}

	return &hunk{
		header:        fmt.Sprintf("@@ -%d,%d +%d,%d @@", originalStart, originalCount, modifiedStart, modifiedCount),
		originalStart: originalStart,
		originalCount: originalCount,
		modifiedStart: modifiedStart,
		modifiedCount: modifiedCount,
	}, nil
}

func parseHunkRange(s string) (start, count int) {
	parts := strings.Split(s, ",")
	if len(parts) != 2 {
		return 1, 1
	}
	fmt.Sscanf(parts[0], "%d", &start)
	fmt.Sscanf(parts[1], "%d", &count)
	if start <= 0 {
		start = 1
	}
	if count <= 0 {
		count = 1
	}
	return start, count
}

func (d *DiffReconstructor) combineHunks(hunks []hunk) []hunk {
	if len(hunks) <= 1 {
		return hunks
	}

	var result []hunk
	current := hunks[0]

	for i := 1; i < len(hunks); i++ {
		next := hunks[i]

		// Check if hunks are adjacent or overlapping
		if next.originalStart <= current.originalStart+current.originalCount+1 {
			// Create a merged hunk that spans both hunks
			var mergedContent []string
			seen := make(map[string]bool)

			// Helper function to add a line if it's not already seen
			addUnique := func(line string) {
				if !seen[line] {
					mergedContent = append(mergedContent, line)
					seen[line] = true
				}
			}

			// Get original content lines
			originalLines := strings.Split(d.originalContent, "\n")

			// Track the current position in the original file
			pos := current.originalStart - 1
			if pos < 0 {
				pos = 0
			}

			// Add leading context from first hunk
			for _, line := range current.content {
				if strings.HasPrefix(line, " ") {
					addUnique(line)
					break
				}
			}

			// Process removals and additions in order
			var changes []struct {
				line     string
				isRemove bool
				isAdd    bool
				pos      int
			}

			// Collect changes from first hunk
			for _, line := range current.content {
				if strings.HasPrefix(line, "-") {
					changes = append(changes, struct {
						line     string
						isRemove bool
						isAdd    bool
						pos      int
					}{line: line, isRemove: true, pos: pos})
				} else if strings.HasPrefix(line, "+") {
					changes = append(changes, struct {
						line     string
						isRemove bool
						isAdd    bool
						pos      int
					}{line: line, isAdd: true, pos: pos})
				}
				if !strings.HasPrefix(line, "+") {
					pos++
				}
			}

			// Collect changes from second hunk
			pos = next.originalStart - 1
			for _, line := range next.content {
				if strings.HasPrefix(line, "-") {
					changes = append(changes, struct {
						line     string
						isRemove bool
						isAdd    bool
						pos      int
					}{line: line, isRemove: true, pos: pos})
				} else if strings.HasPrefix(line, "+") {
					changes = append(changes, struct {
						line     string
						isRemove bool
						isAdd    bool
						pos      int
					}{line: line, isAdd: true, pos: pos})
				}
				if !strings.HasPrefix(line, "+") {
					pos++
				}
			}

			// Sort changes by position and type (removals before additions)
			sort.Slice(changes, func(i, j int) bool {
				if changes[i].pos != changes[j].pos {
					return changes[i].pos < changes[j].pos
				}
				return changes[i].isRemove && !changes[j].isRemove
			})

			// Apply changes in order
			lastPos := current.originalStart - 1
			for _, change := range changes {
				// Add context lines if needed
				for p := lastPos + 1; p < change.pos; p++ {
					if p >= 0 && p < len(originalLines) {
						addUnique(" " + originalLines[p])
					}
				}
				addUnique(change.line)
				if change.isRemove {
					lastPos = change.pos
				}
			}

			// Find the last context line from the second hunk
			var lastContextLine string
			for i := len(next.content) - 1; i >= 0; i-- {
				if strings.HasPrefix(next.content[i], " ") {
					lastContextLine = next.content[i]
					break
				}
			}

			// Add final context line
			if lastContextLine != "" {
				addUnique(lastContextLine)
			} else {
				endLine := next.originalStart + next.originalCount - 1
				if endLine >= len(originalLines) {
					endLine = len(originalLines) - 1
				}
				if endLine > lastPos && endLine < len(originalLines) {
					addUnique(" " + originalLines[endLine])
				}
			}

			// Calculate the total span of lines
			startLine := current.originalStart
			endLine := next.originalStart + next.originalCount - 1
			if endLine >= len(originalLines) {
				endLine = len(originalLines) - 1
			}
			totalLines := endLine - startLine + 1

			// Count additions and removals
			addCount := 0
			removeCount := 0
			for _, change := range changes {
				if change.isAdd {
					addCount++
				}
				if change.isRemove {
					removeCount++
				}
			}

			// Update the current hunk
			current.content = mergedContent
			current.originalCount = totalLines - addCount + removeCount
			current.modifiedCount = totalLines + addCount - removeCount
			current.header = fmt.Sprintf("@@ -%d,%d +%d,%d @@",
				current.originalStart, current.originalCount,
				current.modifiedStart, current.modifiedCount)
		} else {
			result = append(result, current)
			current = next
		}
	}
	result = append(result, current)

	return result
}

func contains(slice []string, str string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}
