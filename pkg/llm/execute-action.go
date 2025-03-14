package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/diff"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type CreateWorkspaceFromArchiveAction struct {
	ArchivePath string `json:"archivePath"`
	ArchiveType string `json:"archiveType"` // New field: "helm" or "k8s"
}

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, patchStreamCh chan string) (string, error) {
	updatedContent := currentContent

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(executePlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	detailedPlanMessage := fmt.Sprintf("The Helm chart plan is: %s", plan.Description)
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanMessage)))

	if actionPlanWithPath.Action == "create" {
		createMessage := fmt.Sprintf("Create the file at %s", actionPlanWithPath.Path)
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(createMessage)))
	} else if actionPlanWithPath.Action == "update" {
		updateMessage := fmt.Sprintf(`The file at %s needs to be updated according to the plan.`,
			actionPlanWithPath.Path)

		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(updateMessage)))
	}

	tools := []anthropic.ToolParam{
		{
			Name: anthropic.F("text_editor_20250124"),
			InputSchema: anthropic.F(interface{}(map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{
						"type": "string",
						"enum": []string{"view", "str_replace"},
					},
					"path": map[string]interface{}{
						"type": "string",
					},
					"old_str": map[string]interface{}{
						"type": "string",
					},
					"new_str": map[string]interface{}{
						"type": "string",
					},
				},
			})),
		},
	}

	toolUnionParams := make([]anthropic.ToolUnionUnionParam, len(tools))
	for i, tool := range tools {
		toolUnionParams[i] = tool
	}

	for {
		stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
			MaxTokens: anthropic.F(int64(8192)),
			Messages:  anthropic.F(messages),
			Tools:     anthropic.F(toolUnionParams),
		})

		message := anthropic.Message{}
		for stream.Next() {
			event := stream.Current()
			err := message.Accumulate(event)
			if err != nil {
				return "", err
			}
		}

		if stream.Err() != nil {
			return "", stream.Err()
		}

		messages = append(messages, message.ToParam())

		hasToolCalls := false
		toolResults := []anthropic.ContentBlockParamUnion{}

		for _, block := range message.Content {
			if block.Type == anthropic.ContentBlockTypeToolUse {
				hasToolCalls = true
				var response interface{}

				var input struct {
					Command string `json:"command"`
					Path    string `json:"path"`
					OldStr  string `json:"old_str"`
					NewStr  string `json:"new_str"`
				}

				if err := json.Unmarshal(block.Input, &input); err != nil {
					return "", err
				}

				if input.Command == "view" {
					response = updatedContent
				} else if input.Command == "str_replace" {
					updatedContent = strings.ReplaceAll(updatedContent, input.OldStr, input.NewStr)
					patch, err := diff.GeneratePatch(currentContent, updatedContent, actionPlanWithPath.Path)
					if err != nil {
						return "", err
					}

					patchStreamCh <- patch
					response = "Updated"
				}

				b, err := json.Marshal(response)
				if err != nil {
					return "", err
				}

				toolResults = append(toolResults, anthropic.NewToolResultBlock(block.ID, string(b), false))
			}
		}

		if !hasToolCalls {
			break
		}

		messages = append(messages, anthropic.MessageParam{
			Role:    anthropic.F(anthropic.MessageParamRoleUser),
			Content: anthropic.F(toolResults),
		})
	}

	// Generate a unified diff patch
	patch, err := diff.GeneratePatch(currentContent, updatedContent, actionPlanWithPath.Path)
	if err != nil {
		return "", fmt.Errorf("failed to generate patch: %w", err)
	}

	// Send the patch to the channel if it's provided
	if patchStreamCh != nil {
		patchStreamCh <- patch
	}

	return patch, nil
}

// Helper functions
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

// Hunk represents a group of changes with context
type Hunk struct {
	origStart, origEnd int
	newStart, newEnd   int
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

// Point represents a position in the LCS matrix
type Point struct {
	X, Y int
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
