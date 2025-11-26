package diff

import (
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/logger"
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
	contextLines  []string // Lines with space prefix - used for fuzzy matching
	removedLines  []string // Lines with - prefix
	addedLines    []string // Lines with + prefix
}

type DiffReconstructor struct {
	originalContent string
	diffContent     string
	debug           bool
}

func NewDiffReconstructor(originalContent, diffContent string) *DiffReconstructor {
	return &DiffReconstructor{
		originalContent: normalizeLineEndings(originalContent),
		diffContent:     normalizeLineEndings(diffContent),
		debug:           false,
	}
}

func NewDiffReconstructorWithDebug(originalContent, diffContent string, debug bool) *DiffReconstructor {
	return &DiffReconstructor{
		originalContent: normalizeLineEndings(originalContent),
		diffContent:     normalizeLineEndings(diffContent),
		debug:           debug,
	}
}

func normalizeLineEndings(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "\r\n", "\n"), "\r", "\n")
}

func (d *DiffReconstructor) logDebug(format string, args ...interface{}) {
	if d.debug {
		logger.Debugf(format, args...)
	}
}

func (d *DiffReconstructor) ReconstructDiff() (string, error) {
	lines := strings.Split(strings.TrimSpace(d.diffContent), "\n")
	if len(lines) < 3 {
		return "", fmt.Errorf("invalid diff: too few lines (got %d, need at least 3)", len(lines))
	}

	// Find first valid header pair
	origFile := "file"
	startIdx := 0

	// Look for standard headers
	foundHeaders, of, _, si := d.findFirstValidHeaders(lines)
	if foundHeaders {
		origFile, startIdx = of, si
	} else {
		// For diffs without standard headers, try to find hunk markers
		hunkIdx := -1
		for i, line := range lines {
			if strings.HasPrefix(line, "@@") {
				hunkIdx = i
				break
			}
		}

		if hunkIdx >= 0 {
			startIdx = hunkIdx
		}
	}

	// Extract hunks from the diff
	hunks, err := d.parseHunks(lines[startIdx:])
	if err != nil {
		return "", fmt.Errorf("failed to parse hunks: %w", err)
	}

	// If no hunks found, this is not a valid diff
	if len(hunks) == 0 {
		return "", fmt.Errorf("no valid hunks found in diff")
	}

	// Analyze each hunk to improve matching
	enhancedHunks, err := d.enhanceHunks(hunks)
	if err != nil {
		return "", fmt.Errorf("failed to enhance hunks: %w", err)
	}

	// Try to fix hunk positions using fuzzy matching if needed
	correctedHunks, err := d.findHunkPositions(enhancedHunks)
	if err != nil {
		return "", fmt.Errorf("failed to find hunk positions: %w", err)
	}

	// Build the final diff
	var result strings.Builder

	// Preserve original header format if it matches standard format
	if foundHeaders {
		headerLines := lines[:startIdx]
		if len(headerLines) >= 2 &&
			strings.HasPrefix(headerLines[0], "--- ") &&
			strings.HasPrefix(headerLines[1], "+++ ") {
			result.WriteString(headerLines[0] + "\n")
			result.WriteString(headerLines[1] + "\n")
		}
	} else {
		// Fall back to normalized format
		basePath := filepath.Base(origFile)
		if strings.Contains(d.diffContent, "Chart.yaml") {
			result.WriteString(fmt.Sprintf("--- %s\n", basePath))
			result.WriteString(fmt.Sprintf("+++ %s\n", basePath))
		} else {
			result.WriteString(fmt.Sprintf("--- a/%s\n", basePath))
			result.WriteString(fmt.Sprintf("+++ b/%s\n", basePath))
		}
	}

	// Write hunks with corrected line numbers
	for _, h := range correctedHunks {
		// Generate updated header with corrected line numbers
		result.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n",
			h.originalStart, h.originalCount, h.modifiedStart, h.modifiedCount))

		for _, line := range h.content {
			result.WriteString(line + "\n")
		}
	}

	return result.String(), nil
}

func (d *DiffReconstructor) findFirstValidHeaders(lines []string) (bool, string, string, int) {
	for i := 0; i < len(lines)-1; i++ {
		if strings.HasPrefix(strings.TrimSpace(lines[i]), "--- ") &&
			strings.HasPrefix(strings.TrimSpace(lines[i+1]), "+++ ") {
			return true,
				strings.TrimPrefix(strings.TrimSpace(lines[i]), "--- "),
				strings.TrimPrefix(strings.TrimSpace(lines[i+1]), "+++ "),
				i + 2
		}
	}
	return false, "", "", -1
}

func (d *DiffReconstructor) parseHunks(lines []string) ([]hunk, error) {
	var hunks []hunk
	var currentHunk *hunk

	// Handle special case for missing header format like "@@" without line numbers
	if len(lines) > 0 && lines[0] == "@@" {
		// Initialize a hunk with default values
		currentHunk = &hunk{
			header:        "@@",
			content:       []string{},
			originalStart: 1,
			originalCount: 1,
			modifiedStart: 1,
			modifiedCount: 1,
			contextLines:  []string{},
			removedLines:  []string{},
			addedLines:    []string{},
		}

		// Process the remaining lines
		for i := 1; i < len(lines); i++ {
			line := strings.TrimRight(lines[i], "\r\n")
			if !strings.HasPrefix(line, "---") && !strings.HasPrefix(line, "+++") {
				currentHunk.content = append(currentHunk.content, line)

				// Categorize by line type for later analysis
				if strings.HasPrefix(line, " ") {
					currentHunk.contextLines = append(currentHunk.contextLines, strings.TrimPrefix(line, " "))
				} else if strings.HasPrefix(line, "-") {
					currentHunk.removedLines = append(currentHunk.removedLines, strings.TrimPrefix(line, "-"))
				} else if strings.HasPrefix(line, "+") {
					currentHunk.addedLines = append(currentHunk.addedLines, strings.TrimPrefix(line, "+"))
				}
			}
		}

		// Add the hunk and return
		if len(currentHunk.content) > 0 {
			// Count the number of lines
			addCount := len(currentHunk.addedLines)
			removeCount := len(currentHunk.removedLines)
			contextCount := len(currentHunk.contextLines)

			currentHunk.originalCount = removeCount + contextCount
			currentHunk.modifiedCount = addCount + contextCount

			hunks = append(hunks, *currentHunk)
			return hunks, nil
		}
	}

	// Standard parsing for normal hunks
	for i := 0; i < len(lines); i++ {
		line := strings.TrimRight(lines[i], "\r\n")

		if strings.HasPrefix(line, "@@ ") {
			if currentHunk != nil {
				// Save any existing hunk before starting a new one
				hunks = append(hunks, *currentHunk)
			}

			// Initialize a new hunk
			h := &hunk{
				header:       line,
				content:      []string{},
				contextLines: []string{},
				removedLines: []string{},
				addedLines:   []string{},
			}

			// Try to parse the header, but it's okay if we can't
			if parts := strings.Split(line, " "); len(parts) >= 3 {
				original := strings.TrimPrefix(parts[1], "-")
				modified := strings.TrimPrefix(parts[2], "+")

				h.originalStart, h.originalCount = parseHunkRange(original)
				h.modifiedStart, h.modifiedCount = parseHunkRange(modified)
			} else {
				// Can't parse header, use default values
				h.originalStart = 1
				h.originalCount = 1
				h.modifiedStart = 1
				h.modifiedCount = 1
			}

			currentHunk = h
			continue
		}

		if currentHunk != nil && !strings.HasPrefix(line, "---") && !strings.HasPrefix(line, "+++") {
			// Add line to current hunk content
			currentHunk.content = append(currentHunk.content, line)

			// Also categorize by line type for later analysis
			if strings.HasPrefix(line, " ") {
				currentHunk.contextLines = append(currentHunk.contextLines, strings.TrimPrefix(line, " "))
			} else if strings.HasPrefix(line, "-") {
				currentHunk.removedLines = append(currentHunk.removedLines, strings.TrimPrefix(line, "-"))
			} else if strings.HasPrefix(line, "+") {
				currentHunk.addedLines = append(currentHunk.addedLines, strings.TrimPrefix(line, "+"))
			}
		} else if currentHunk == nil && (strings.HasPrefix(line, " ") ||
			strings.HasPrefix(line, "+") || strings.HasPrefix(line, "-")) {
			// Handle case where there is no explicit hunk marker but content looks like a diff
			currentHunk = &hunk{
				header:        "@@",
				content:       []string{},
				originalStart: 1,
				originalCount: 1,
				modifiedStart: 1,
				modifiedCount: 1,
				contextLines:  []string{},
				removedLines:  []string{},
				addedLines:    []string{},
			}

			// Add this line to the content
			currentHunk.content = append(currentHunk.content, line)

			// Categorize by line type
			if strings.HasPrefix(line, " ") {
				currentHunk.contextLines = append(currentHunk.contextLines, strings.TrimPrefix(line, " "))
			} else if strings.HasPrefix(line, "-") {
				currentHunk.removedLines = append(currentHunk.removedLines, strings.TrimPrefix(line, "-"))
			} else if strings.HasPrefix(line, "+") {
				currentHunk.addedLines = append(currentHunk.addedLines, strings.TrimPrefix(line, "+"))
			}
		}
	}

	if currentHunk != nil {
		// Count the number of lines for better line counts
		addCount := len(currentHunk.addedLines)
		removeCount := len(currentHunk.removedLines)
		contextCount := len(currentHunk.contextLines)

		// Update line counts if this was an inferred hunk
		if currentHunk.header == "@@" {
			currentHunk.originalCount = removeCount + contextCount
			currentHunk.modifiedCount = addCount + contextCount
		}

		hunks = append(hunks, *currentHunk)
	}

	return hunks, nil
}

func (d *DiffReconstructor) enhanceHunks(hunks []hunk) ([]hunk, error) {
	enhancedHunks := make([]hunk, len(hunks))

	for i, h := range hunks {
		enhancedHunk := h

		// Extract context before and after the changes
		var contextBefore, contextAfter []string
		inChanges := false

		for _, line := range h.content {
			if strings.HasPrefix(line, "-") || strings.HasPrefix(line, "+") {
				inChanges = true
			} else if strings.HasPrefix(line, " ") {
				if !inChanges {
					contextBefore = append(contextBefore, strings.TrimPrefix(line, " "))
				} else {
					contextAfter = append(contextAfter, strings.TrimPrefix(line, " "))
				}
			}
		}

		enhancedHunk.contextBefore = contextBefore
		enhancedHunk.contextAfter = contextAfter

		// Preserve original content exactly, including all whitespace
		// This avoids mangling indentation in the patches
		enhancedHunks[i] = enhancedHunk
	}

	return enhancedHunks, nil
}

func (d *DiffReconstructor) findHunkPositions(hunks []hunk) ([]hunk, error) {
	originalLines := strings.Split(d.originalContent, "\n")
	correctedHunks := make([]hunk, 0, len(hunks))

	for _, h := range hunks {
		correctedHunk := h

		// If the hunk has no context lines, try to use the removed lines for matching
		effectiveContext := h.contextLines
		if len(effectiveContext) == 0 && len(h.removedLines) > 0 {
			effectiveContext = h.removedLines
		}

		// If we still have no context, use the original start position
		if len(effectiveContext) == 0 {
			// Keep original position
			correctedHunks = append(correctedHunks, correctedHunk)
			continue
		}

		// Try to find the best position for this hunk using fuzzy matching
		bestPos, score := d.findBestMatchForHunk(originalLines, effectiveContext)
		d.logDebug("Best match for hunk at original pos %d: new pos %d with score %.2f",
			h.originalStart, bestPos, score)

		if score > 0.6 && bestPos > 0 { // Only adjust if we have a good match
			// Adjust the line numbers
			deltaPos := bestPos - h.originalStart
			correctedHunk.originalStart = bestPos
			correctedHunk.modifiedStart = h.modifiedStart + deltaPos

			// Adjust content indentation if needed
			correctedHunk.content = d.adjustIndentation(correctedHunk.content, originalLines, bestPos)

			correctedHunks = append(correctedHunks, correctedHunk)
		} else {
			// Keep original position if no good match found
			correctedHunks = append(correctedHunks, correctedHunk)
		}
	}

	// Sort hunks by position to ensure proper ordering
	sort.Slice(correctedHunks, func(i, j int) bool {
		return correctedHunks[i].originalStart < correctedHunks[j].originalStart
	})

	return correctedHunks, nil
}

func (d *DiffReconstructor) findBestMatchForHunk(originalLines []string, contextLines []string) (int, float64) {
	if len(contextLines) == 0 || len(originalLines) == 0 {
		return 1, 0 // No context to match
	}

	bestPos := 1
	bestScore := 0.0

	// Try to match each potential position
	for pos := 1; pos <= len(originalLines)-len(contextLines)+1; pos++ {
		score := 0.0
		matchCount := 0

		// Calculate how well context lines match at this position
		for i, contextLine := range contextLines {
			if pos+i-1 < len(originalLines) {
				origLine := originalLines[pos+i-1]
				similarity := calculateStringSimilarity(contextLine, origLine)
				score += similarity
				if similarity > 0.8 {
					matchCount++
				}
			}
		}

		// Normalize score
		avgScore := score / float64(len(contextLines))

		// Bonus for consecutive matches
		if matchCount > 2 {
			avgScore += 0.1 * float64(matchCount) / float64(len(contextLines))
		}

		if avgScore > bestScore {
			bestScore = avgScore
			bestPos = pos
		}
	}

	return bestPos, bestScore
}

func (d *DiffReconstructor) adjustIndentation(lines []string, originalLines []string, startPos int) []string {
	// For whitespace-sensitive issues, just preserve the original lines
	// This is a more conservative approach that prevents whitespace mangling
	return lines

	// Below is the original, more aggressive whitespace-fixing approach
	// Left commented for future reference if needed
	/*
		adjustedLines := make([]string, len(lines))
		linePos := startPos - 1 // Convert to 0-based indexing

		for i, line := range lines {
			if strings.HasPrefix(line, " ") {
				// Context line - adjust indentation based on original
				content := strings.TrimPrefix(line, " ")
				if linePos >= 0 && linePos < len(originalLines) {
					// Get indentation from original file
					origIndent := extractIndentation(originalLines[linePos])
					adjustedLines[i] = " " + origIndent + strings.TrimLeft(content, " \t")
					linePos++
				} else {
					adjustedLines[i] = line // Keep as-is
				}
			} else if strings.HasPrefix(line, "-") {
				// Removed line - also adjust indentation
				content := strings.TrimPrefix(line, "-")
				if linePos >= 0 && linePos < len(originalLines) {
					origIndent := extractIndentation(originalLines[linePos])
					adjustedLines[i] = "-" + origIndent + strings.TrimLeft(content, " \t")
					linePos++
				} else {
					adjustedLines[i] = line
				}
			} else if strings.HasPrefix(line, "+") {
				// Added line - try to use same indentation as surrounding context
				content := strings.TrimPrefix(line, "+")
				// Use same indentation as previous line if possible
				prevIndent := ""
				if i > 0 && (strings.HasPrefix(lines[i-1], " ") || strings.HasPrefix(lines[i-1], "-")) {
					prevIndent = extractIndentation(strings.TrimPrefix(strings.TrimPrefix(lines[i-1], " "), "-"))
				}
				adjustedLines[i] = "+" + prevIndent + strings.TrimLeft(content, " \t")
			} else {
				adjustedLines[i] = line // Keep other lines as-is
			}
		}

		return adjustedLines
	*/
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

// Extracts just the leading whitespace from a string
func extractIndentation(s string) string {
	return strings.Repeat(" ", len(s)-len(strings.TrimLeft(s, " \t")))
}

// Calculate string similarity (improved version with multiple strategies)
func calculateStringSimilarity(a, b string) float64 {
	// Normalize strings by trimming leading/trailing whitespace and converting to lowercase
	aNorm := strings.TrimSpace(a)
	bNorm := strings.TrimSpace(b)

	// For empty strings
	if len(aNorm) == 0 && len(bNorm) == 0 {
		return 1.0
	}
	if len(aNorm) == 0 || len(bNorm) == 0 {
		return 0.0
	}

	// Different similarity measures:

	// 1. Simple character by character matching
	charMatch := calculateCharacterMatch(aNorm, bNorm)

	// 2. Token-based similarity (splits by whitespace and compares tokens)
	tokenMatch := calculateTokenMatch(aNorm, bNorm)

	// 3. Indentation-aware comparison (ignore indentation differences)
	indentationMatch := calculateIndentationAwareMatch(a, b)

	// Combine scores giving priority to token and indentation matching
	return 0.2*charMatch + 0.4*tokenMatch + 0.4*indentationMatch
}

// Calculates character-by-character similarity
func calculateCharacterMatch(a, b string) float64 {
	maxLen := max(len(a), len(b))
	if maxLen == 0 {
		return 1.0
	}

	// Count matching characters
	matchCount := 0
	for i := 0; i < min(len(a), len(b)); i++ {
		if a[i] == b[i] {
			matchCount++
		}
	}

	return float64(matchCount) / float64(maxLen)
}

// Calculates token-based similarity
func calculateTokenMatch(a, b string) float64 {
	aTokens := strings.Fields(a)
	bTokens := strings.Fields(b)

	if len(aTokens) == 0 && len(bTokens) == 0 {
		return 1.0
	}
	if len(aTokens) == 0 || len(bTokens) == 0 {
		return 0.0
	}

	// Count matching tokens
	matches := 0
	for _, at := range aTokens {
		for _, bt := range bTokens {
			if at == bt {
				matches++
				break
			}
		}
	}

	// Return match ratio
	return float64(matches) / float64(max(len(aTokens), len(bTokens)))
}

// Calculates indentation-aware matching
func calculateIndentationAwareMatch(a, b string) float64 {
	// Strip all whitespace and compare
	aStripped := regexp.MustCompile(`\s+`).ReplaceAllString(a, "")
	bStripped := regexp.MustCompile(`\s+`).ReplaceAllString(b, "")

	if len(aStripped) == 0 && len(bStripped) == 0 {
		return 1.0
	}
	if len(aStripped) == 0 || len(bStripped) == 0 {
		return 0.0
	}

	// Calculate exact match percentage
	matchCount := 0
	for i := 0; i < min(len(aStripped), len(bStripped)); i++ {
		if aStripped[i] == bStripped[i] {
			matchCount++
		}
	}

	return float64(matchCount) / float64(max(len(aStripped), len(bStripped)))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func contains(slice []string, str string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}
