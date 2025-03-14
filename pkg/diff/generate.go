package diff

import (
	"fmt"
	"strings"
)

// Hunk represents a group of changes with context
type Hunk struct {
	origStart, origEnd int
	newStart, newEnd   int
}

// Point represents a position in the LCS matrix
type Point struct {
	X, Y int
}

// GeneratePatch generates a unified diff patch between original and updated content
func GeneratePatch(originalContent, updatedContent, filePath string) (string, error) {
	originalLines := strings.Split(originalContent, "\n")
	updatedLines := strings.Split(updatedContent, "\n")

	var readableDiff strings.Builder
	readableDiff.WriteString(fmt.Sprintf("--- %s\n", filePath))
	readableDiff.WriteString(fmt.Sprintf("+++ %s\n", filePath))

	// Create a map of line changes using the Myers diff algorithm
	changes := computeChanges(originalLines, updatedLines)

	// Group changes into hunks with context
	contextLines := 3
	hunks := groupChangesIntoHunks(changes, contextLines, len(originalLines), len(updatedLines))

	// Generate the diff output
	for _, hunk := range hunks {
		// Print hunk header
		readableDiff.WriteString(fmt.Sprintf("\n@@ -%d,%d +%d,%d @@\n",
			hunk.origStart+1, hunk.origEnd-hunk.origStart,
			hunk.newStart+1, hunk.newEnd-hunk.newStart))

		// Print the hunk content with proper context
		i, j := hunk.origStart, hunk.newStart
		for i < hunk.origEnd || j < hunk.newEnd {
			if i < hunk.origEnd && j < hunk.newEnd && changes[i][j] == 0 {
				// Unchanged line
				readableDiff.WriteString(" " + originalLines[i] + "\n")
				i++
				j++
			} else if i < hunk.origEnd && (j >= hunk.newEnd || changes[i][j] <= 0) {
				// Deleted line
				readableDiff.WriteString("-" + originalLines[i] + "\n")
				i++
			} else if j < hunk.newEnd && (i >= hunk.origEnd || changes[i][j] >= 0) {
				// Added line
				readableDiff.WriteString("+" + updatedLines[j] + "\n")
				j++
			}
		}
	}

	return readableDiff.String(), nil
}

// computeChanges creates a 2D matrix indicating line changes:
// 0 = unchanged, -1 = deleted, 1 = added
func computeChanges(orig, new []string) [][]int {
	// Create a matrix to track changes
	changes := make([][]int, len(orig))
	for i := range changes {
		changes[i] = make([]int, len(new))
		for j := range changes[i] {
			if orig[i] == new[j] {
				changes[i][j] = 0 // unchanged
			} else {
				changes[i][j] = 2 // placeholder for "not compared yet"
			}
		}
	}

	// Use a simplified LCS approach to mark changes
	lcs := findLCS(orig, new)

	// Mark all lines as changed by default
	for i := range changes {
		for j := range changes[i] {
			if changes[i][j] != 0 {
				changes[i][j] = -1 // assume deletion
			}
		}
	}

	// Mark the LCS matches as unchanged
	for _, match := range lcs {
		changes[match.X][match.Y] = 0 // unchanged
	}

	// Mark additions
	for j := range new {
		isAddition := true
		for i := range orig {
			if changes[i][j] == 0 {
				isAddition = false
				break
			}
		}
		if isAddition {
			for i := range orig {
				if changes[i][j] == -1 {
					changes[i][j] = 1 // addition
				}
			}
		}
	}

	return changes
}

// findLCS finds the longest common subsequence between two slices of strings
func findLCS(a, b []string) []Point {
	// Create a matrix to store the length of LCS
	m, n := len(a), len(b)
	dp := make([][]int, m+1)
	for i := range dp {
		dp[i] = make([]int, n+1)
	}

	// Fill the dp table
	for i := 1; i <= m; i++ {
		for j := 1; j <= n; j++ {
			if a[i-1] == b[j-1] {
				dp[i][j] = dp[i-1][j-1] + 1
			} else {
				dp[i][j] = max(dp[i-1][j], dp[i][j-1])
			}
		}
	}

	// Backtrack to find the actual sequence
	var result []Point
	i, j := m, n
	for i > 0 && j > 0 {
		if a[i-1] == b[j-1] {
			result = append(result, Point{i - 1, j - 1})
			i--
			j--
		} else if dp[i-1][j] > dp[i][j-1] {
			i--
		} else {
			j--
		}
	}

	// Reverse the result since we backtracked
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// groupChangesIntoHunks groups changes into hunks with context
func groupChangesIntoHunks(changes [][]int, contextLines, origLen, newLen int) []Hunk {
	var hunks []Hunk

	// Find changed lines
	var changedLines []int
	for i := 0; i < origLen; i++ {
		for j := 0; j < newLen; j++ {
			if changes[i][j] != 0 {
				changedLines = append(changedLines, i)
				break
			}
		}
	}

	// If no changes, return empty hunks
	if len(changedLines) == 0 {
		return hunks
	}

	// Group adjacent changed lines into hunks
	hunkStart := changedLines[0]
	hunkEnd := changedLines[0] + 1

	for i := 1; i < len(changedLines); i++ {
		if changedLines[i] <= hunkEnd+contextLines*2 {
			// Extend current hunk
			hunkEnd = changedLines[i] + 1
		} else {
			// Create a new hunk
			hunks = append(hunks, createHunk(changes, hunkStart, hunkEnd, contextLines, origLen, newLen))
			hunkStart = changedLines[i]
			hunkEnd = changedLines[i] + 1
		}
	}

	// Add the last hunk
	hunks = append(hunks, createHunk(changes, hunkStart, hunkEnd, contextLines, origLen, newLen))

	return hunks
}

// createHunk creates a hunk with context
func createHunk(changes [][]int, start, end, contextLines, origLen, newLen int) Hunk {
	// Add context before
	origStart := max(0, start-contextLines)

	// Add context after
	origEnd := min(origLen, end+contextLines)

	// Find corresponding new file range
	newStart, newEnd := findNewRange(changes, origStart, origEnd, contextLines, newLen)

	return Hunk{
		origStart: origStart,
		origEnd:   origEnd,
		newStart:  newStart,
		newEnd:    newEnd,
	}
}

// findNewRange finds the corresponding range in the new file
func findNewRange(changes [][]int, origStart, origEnd, contextLines, newLen int) (int, int) {
	newStart, newEnd := newLen, 0

	// Find the minimum and maximum new file indices that correspond to the original range
	for i := origStart; i < origEnd; i++ {
		for j := 0; j < newLen; j++ {
			if changes[i][j] == 0 {
				// This is a matching line
				if j < newStart {
					newStart = j
				}
				if j+1 > newEnd {
					newEnd = j + 1
				}
			} else if changes[i][j] == 1 {
				// This is an addition
				if j < newStart {
					newStart = j
				}
				if j+1 > newEnd {
					newEnd = j + 1
				}
			}
		}
	}

	// If no matching lines were found, use a reasonable default
	if newStart > newEnd {
		newStart = 0
		newEnd = newLen
	}

	// Ensure we include context in the new file too
	newStart = max(0, newStart-contextLines)
	newEnd = min(newLen, newEnd+contextLines)

	return newStart, newEnd
}
