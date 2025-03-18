package diff

import (
	"fmt"
	"regexp"
	"strings"
)

// ApplyPatches applies multiple unified diff patches sequentially to the content
func ApplyPatches(content string, patches []string) (string, error) {
	patchedContent := content
	for _, patch := range patches {
		patch = strings.TrimSpace(patch)
		if patch == "" {
			continue
		}

		var err error
		patchedContent, err = ApplyPatch(patchedContent, patch)
		if err != nil {
			return "", fmt.Errorf("failed to apply patch: %w", err)
		}
	}

	return patchedContent, nil
}

// ApplyPatch applies a single unified diff patch to the content
func ApplyPatch(content string, patchText string) (string, error) {
	// Normalize line endings for consistent processing
	content = normalizeLineEndings(content)
	patchText = normalizeLineEndings(patchText)

	// Handle empty patch
	patchText = strings.TrimSpace(patchText)
	if patchText == "" {
		return content, nil
	}

	// Parse the patch
	patchLines := strings.Split(patchText, "\n")
	if len(patchLines) < 3 {
		// Handle trivial cases for very simple patches
		if len(patchLines) == 1 && (strings.HasPrefix(patchLines[0], "+") || 
		                           strings.HasPrefix(patchLines[0], "-") ||
		                           strings.HasPrefix(patchLines[0], " ")) {
			// Handle as a simple single-line patch
			if strings.HasPrefix(patchLines[0], "+") {
				return content + strings.TrimPrefix(patchLines[0], "+") + "\n", nil
			} else if strings.HasPrefix(patchLines[0], "-") {
				// Can't apply removal without context
				return content, nil
			} else {
				return content, nil
			}
		}
		return content, fmt.Errorf("invalid patch: too few lines")
	}

	// Extract hunks from the patch
	hunks, err := extractHunks(patchText)
	if err != nil {
		return content, fmt.Errorf("failed to parse hunks: %w", err)
	}

	// If no hunks found, return the original content
	if len(hunks) == 0 {
		return content, nil
	}

	// Parse the content into lines
	contentLines := strings.Split(content, "\n")
	
	// Prepare the processing structures
	result := applyHunksToContent(contentLines, hunks)
	
	// Join the resulting lines
	resultText := strings.Join(result, "\n")

	// Preserve trailing newline if present in original
	if strings.HasSuffix(content, "\n") && !strings.HasSuffix(resultText, "\n") {
		resultText += "\n"
	}
	
	return resultText, nil
}

// extractHunks parses a patch and extracts all hunks
func extractHunks(patchText string) ([]hunk, error) {
	patchLines := strings.Split(patchText, "\n")
	
	// First approach: use our own parser to extract hunks
	var hunks []hunk
	var currentHunk *hunk
	var hunkStarted bool = false
	
	// Look for hunk headers (@@) and build hunks
	for _, line := range patchLines {
		if strings.HasPrefix(line, "@@") {
			// If we already had a hunk, save it
			if currentHunk != nil {
				hunks = append(hunks, *currentHunk)
			}
			
			// Parse the hunk header
			h := &hunk{
				header:       line,
				content:      []string{},
				contextLines: []string{},
				removedLines: []string{},
				addedLines:   []string{},
			}
			
			// Parse line numbers from the header
			re := regexp.MustCompile(`@@ -(\d+),(\d+) \+(\d+),(\d+) @@`)
			matches := re.FindStringSubmatch(line)
			if len(matches) == 5 {
				fmt.Sscanf(matches[1], "%d", &h.originalStart)
				fmt.Sscanf(matches[2], "%d", &h.originalCount)
				fmt.Sscanf(matches[3], "%d", &h.modifiedStart)
				fmt.Sscanf(matches[4], "%d", &h.modifiedCount)
				hunkStarted = true
			} else {
				// Fall back to simpler parsing if regex doesn't match
				parts := strings.Split(line, " ")
				if len(parts) >= 3 {
					original := strings.TrimPrefix(parts[1], "-")
					modified := strings.TrimPrefix(parts[2], "+")
					
					h.originalStart, h.originalCount = parseHunkRange(original)
					h.modifiedStart, h.modifiedCount = parseHunkRange(modified)
					hunkStarted = true
				}
			}
			
			currentHunk = h
		} else if currentHunk != nil && !strings.HasPrefix(line, "---") && !strings.HasPrefix(line, "+++") {
			// Add line to current hunk
			currentHunk.content = append(currentHunk.content, line)
			
			// Categorize line by type
			if strings.HasPrefix(line, " ") {
				currentHunk.contextLines = append(currentHunk.contextLines, strings.TrimPrefix(line, " "))
			} else if strings.HasPrefix(line, "-") {
				currentHunk.removedLines = append(currentHunk.removedLines, strings.TrimPrefix(line, "-"))
			} else if strings.HasPrefix(line, "+") {
				currentHunk.addedLines = append(currentHunk.addedLines, strings.TrimPrefix(line, "+"))
			}
		}
	}
	
	// Add the last hunk if there is one
	if currentHunk != nil {
		hunks = append(hunks, *currentHunk)
	}
	
	// If no hunks found with our parser, fall back to the reconstructor
	if len(hunks) == 0 || !hunkStarted {
		reconstructor := NewDiffReconstructor("", patchText)
		var err error
		hunks, err = reconstructor.parseHunks(patchLines)
		if err != nil {
			return nil, fmt.Errorf("failed to parse hunks: %w", err)
		}
	}
	
	return hunks, nil
}

// applyHunksToContent applies hunks to the content lines and returns the result
func applyHunksToContent(contentLines []string, hunks []hunk) []string {
	result := make([]string, 0, len(contentLines))
	
	// Track the position in the original content
	linePos := 0
	
	// Process each hunk in order
	for _, hunk := range hunks {
		// Skip invalid hunks
		if hunk.originalStart < 1 || hunk.modifiedStart < 1 {
			continue
		}
		
		// Add lines before the hunk
		for linePos < hunk.originalStart-1 && linePos < len(contentLines) {
			result = append(result, contentLines[linePos])
			linePos++
		}
		
		// Process the hunk content
		hunkPos := 0
		for hunkPos < len(hunk.content) {
			line := hunk.content[hunkPos]
			
			if strings.HasPrefix(line, " ") {
				// Context line - include it
				if linePos < len(contentLines) {
					result = append(result, strings.TrimPrefix(line, " "))
					linePos++
				}
				hunkPos++
			} else if strings.HasPrefix(line, "-") {
				// Removed line - skip it in the result
				if linePos < len(contentLines) {
					linePos++ // Skip this line in the original content
				}
				hunkPos++
			} else if strings.HasPrefix(line, "+") {
				// Added line - add it to the result
				result = append(result, strings.TrimPrefix(line, "+"))
				hunkPos++
			} else {
				// Unknown line prefix - skip it
				hunkPos++
			}
		}
	}
	
	// Add any remaining lines after the last hunk
	for linePos < len(contentLines) {
		result = append(result, contentLines[linePos])
		linePos++
	}
	
	return result
}
