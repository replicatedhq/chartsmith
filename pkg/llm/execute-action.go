package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
	"go.uber.org/zap"
)

const (
	TextEditor_Sonnet37 = "text_editor_20250124"
	TextEditor_Sonnet35 = "text_editor_20241022"

	Model_Sonnet37 = "claude-3-7-sonnet-20250219"
	Model_Sonnet35 = "claude-3-5-sonnet-20241022"

	minFuzzyMatchLen  = 50 // Minimum length for fuzzy matching
	fuzzyMatchTimeout = 10 * time.Second
	chunkSize         = 200 // Increased chunk size for better performance
)

type CreateWorkspaceFromArchiveAction struct {
	ArchivePath string `json:"archivePath"`
	ArchiveType string `json:"archiveType"` // New field: "helm" or "k8s"
}

// StrReplaceLog represents a record in the str_replace_log table
type StrReplaceLog struct {
	ID             string    `json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	FilePath       string    `json:"file_path"`
	Found          bool      `json:"found"`
	OldStr         string    `json:"old_str"`
	NewStr         string    `json:"new_str"`
	UpdatedContent string    `json:"updated_content"`
	OldStrLen      int       `json:"old_str_len"`
	NewStrLen      int       `json:"new_str_len"`
	ContextBefore  string    `json:"context_before,omitempty"`
	ContextAfter   string    `json:"context_after,omitempty"`
	ErrorMessage   string    `json:"error_message,omitempty"`
}

// logStrReplaceOperation logs detailed information about each str_replace operation to the database
func logStrReplaceOperation(ctx context.Context, filePath, oldStr, newStr string, fileContent string, found bool) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Generate a random ID for the log entry
	id, err := securerandom.Hex(16)
	if err != nil {
		return fmt.Errorf("failed to generate random ID for str_replace_log: %w", err)
	}

	// Extract context before/after if available
	var contextBefore, contextAfter string
	if strings.Contains(oldStr, "###CONTEXT_BEFORE###") && strings.Contains(oldStr, "###CONTEXT_AFTER###") {
		parts := strings.Split(oldStr, "###CONTEXT_BEFORE###")
		if len(parts) > 1 {
			afterParts := strings.Split(parts[1], "###CONTEXT_AFTER###")
			if len(afterParts) > 1 {
				contextBefore = afterParts[0]
				contextAfter = afterParts[1]
			}
		}
	}

	// Insert into the database
	query := `INSERT INTO str_replace_log (
		id,
		created_at,
		file_path,
		found,
		old_str,
		new_str,
		updated_content,
		old_str_len,
		new_str_len,
		context_before,
		context_after
	) VALUES (
		$1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10
	) RETURNING id`

	var returnedID string
	err = conn.QueryRow(ctx, query,
		id,
		filePath,
		found,
		oldStr,
		newStr,
		fileContent,
		len(oldStr),
		len(newStr),
		contextBefore,
		contextAfter).Scan(&returnedID)

	if err != nil {
		return fmt.Errorf("failed to insert str_replace_log: %w", err)
	}

	// Don't log the content of strings to avoid filling logs
	logger.Debug("Logged str_replace operation to database",
		zap.String("id", returnedID),
		zap.String("file_path", filePath),
		zap.Bool("found", found))

	return nil
}

// UpdateStrReplaceLogErrorMessage updates the error message for a recently logged str_replace operation
func UpdateStrReplaceLogErrorMessage(ctx context.Context, filePath, oldStr, errorMessage string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `
		UPDATE str_replace_log
		SET error_message = $1
		WHERE id IN (
			SELECT id FROM str_replace_log
			WHERE file_path = $2 AND old_str = $3 AND found = false
			ORDER BY created_at DESC
			LIMIT 1
		)
	`

	_, err := conn.Exec(ctx, query, errorMessage, filePath, oldStr)
	if err != nil {
		return fmt.Errorf("failed to update error message in str_replace log: %w", err)
	}

	return nil
}

// GetStrReplaceLogs retrieves a list of str_replace logs with optional filtering
func GetStrReplaceLogs(ctx context.Context, limit int, foundOnly bool, filePath string) ([]StrReplaceLog, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Build the query with optional filters
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
		SELECT
			id, created_at, file_path, found, old_str, new_str,
			updated_content, old_str_len, new_str_len,
			context_before, context_after, error_message
		FROM str_replace_log
		WHERE 1=1
	`)

	args := []interface{}{}
	argIdx := 1

	if foundOnly {
		queryBuilder.WriteString(fmt.Sprintf(" AND found = $%d", argIdx))
		args = append(args, true)
		argIdx++
	}

	if filePath != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND file_path = $%d", argIdx))
		args = append(args, filePath)
		argIdx++
	}

	queryBuilder.WriteString(" ORDER BY created_at DESC")

	if limit > 0 {
		queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", argIdx))
		args = append(args, limit)
	}

	// Execute the query
	rows, err := conn.Query(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query str_replace logs: %w", err)
	}
	defer rows.Close()

	// Parse the results
	var logs []StrReplaceLog
	for rows.Next() {
		var log StrReplaceLog
		var contextBefore, contextAfter, errorMessage interface{}

		err := rows.Scan(
			&log.ID,
			&log.CreatedAt,
			&log.FilePath,
			&log.Found,
			&log.OldStr,
			&log.NewStr,
			&log.UpdatedContent,
			&log.OldStrLen,
			&log.NewStrLen,
			&contextBefore,
			&contextAfter,
			&errorMessage,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan str_replace log row: %w", err)
		}

		// Handle null values
		if contextBefore != nil {
			log.ContextBefore = contextBefore.(string)
		}
		if contextAfter != nil {
			log.ContextAfter = contextAfter.(string)
		}
		if errorMessage != nil {
			log.ErrorMessage = errorMessage.(string)
		}

		logs = append(logs, log)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating str_replace log rows: %w", err)
	}

	return logs, nil
}

// GetStrReplaceFailures retrieves a list of failed str_replace operations
func GetStrReplaceFailures(ctx context.Context, limit int) ([]StrReplaceLog, error) {
	return GetStrReplaceLogs(ctx, limit, false, "")
}

func PerformStringReplacement(content, oldStr, newStr string) (string, bool, error) {
	// Add logging to track performance
	startTime := time.Now()
	defer func() {
		logger.Debug("String replacement operation completed", 
			zap.Duration("time_taken", time.Since(startTime)))
	}()
	
	// Log content sizes for diagnostics
	logger.Debug("Starting string replacement", 
		zap.Int("content_size", len(content)), 
		zap.Int("old_string_size", len(oldStr)),
		zap.Int("new_string_size", len(newStr)))
	
	// First try exact match
	if strings.Contains(content, oldStr) {
		logger.Debug("Found exact match, performing replacement")
		updatedContent := strings.ReplaceAll(content, oldStr, newStr)
		return updatedContent, true, nil
	}
	
	logger.Debug("No exact match found, attempting fuzzy matching")

	// Create a context with timeout for fuzzy matching
	ctx, cancel := context.WithTimeout(context.Background(), fuzzyMatchTimeout)
	defer cancel()

	// Create a channel for the result
	resultCh := make(chan struct {
		start, end int
		err        error
	}, 1)

	// Run fuzzy matching in a goroutine
	go func() {
		logger.Debug("Starting fuzzy match search")
		fuzzyStartTime := time.Now()
		
		start, end := findBestMatchRegion(content, oldStr, minFuzzyMatchLen)
		
		logger.Debug("Fuzzy match search completed", 
			zap.Duration("time_taken", time.Since(fuzzyStartTime)),
			zap.Int("start_pos", start),
			zap.Int("end_pos", end))
			
		if start == -1 || end == -1 {
			resultCh <- struct {
				start, end int
				err        error
			}{-1, -1, fmt.Errorf("Approximate match for replacement not found")}
			return
		}
		resultCh <- struct {
			start, end int
			err        error
		}{start, end, nil}
	}()

	// Wait for result or timeout
	select {
	case result := <-resultCh:
		if result.err != nil {
			logger.Debug("Fuzzy match failed", zap.Error(result.err))
			return content, false, result.err
		}
		// Replace the matched region with newStr
		logger.Debug("Found fuzzy match, performing replacement", 
			zap.Int("match_start", result.start), 
			zap.Int("match_end", result.end),
			zap.Int("match_length", result.end - result.start))
			
		updatedContent := content[:result.start] + newStr + content[result.end:]
		return updatedContent, false, nil
	case <-ctx.Done():
		logger.Warn("Fuzzy matching timed out", 
			zap.Duration("timeout", fuzzyMatchTimeout),
			zap.Duration("time_elapsed", time.Since(startTime)))
		return content, false, fmt.Errorf("fuzzy matching timed out after %v", fuzzyMatchTimeout)
	}
}

func findBestMatchRegion(content, oldStr string, minMatchLen int) (int, int) {
	// Early return if strings are too small
	if len(oldStr) < minMatchLen {
		logger.Debug("String too small for fuzzy matching", 
			zap.Int("length", len(oldStr)), 
			zap.Int("min_length", minMatchLen))
		return -1, -1
	}

	bestStart := -1
	bestEnd := -1
	bestLen := 0
	
	// Set a max number of chunks to process to prevent excessive computation
	maxChunks := 100
	chunksProcessed := 0

	// Use a sliding window approach with overlapping chunks
	// This helps catch matches that might span chunk boundaries
	for i := 0; i < len(oldStr) && chunksProcessed < maxChunks; i += chunkSize / 2 {
		// Determine the end of this chunk with overlap
		chunkEnd := i + chunkSize
		if chunkEnd > len(oldStr) {
			chunkEnd = len(oldStr)
		}

		// Get the current chunk
		chunk := oldStr[i:chunkEnd]
		
		// Skip empty or tiny chunks
		if len(chunk) < 10 {
			continue
		}
		
		chunksProcessed++
		
		// Find all occurrences of this chunk in the content
		start := 0
		maxOccurrences := 100  // Limit number of occurrences to check
		occurrencesChecked := 0
		
		logger.Debug("Processing chunk", 
			zap.Int("chunk_index", i), 
			zap.Int("chunk_size", len(chunk)),
			zap.Int("chunks_processed", chunksProcessed))
		
		for occurrencesChecked < maxOccurrences {
			idx := strings.Index(content[start:], chunk)
			if idx == -1 {
				break
			}
			
			occurrencesChecked++
			
			// Adjust index to be relative to the start of content
			idx += start

			// Try to extend the match forward
			matchStart := idx
			matchEnd := idx + len(chunk)
			matchLen := len(chunk)
			
			// Store the original i value, we'll need it for backward extension
			originalI := i

			// Try to extend forward
			for matchEnd < len(content) && (i+matchLen) < len(oldStr) {
				if content[matchEnd] == oldStr[i+matchLen] {
					matchEnd++
					matchLen++
				} else {
					break
				}
			}

			// Try to extend backward
			// Critical fix: don't modify the outer loop variable i here
			backPos := originalI - 1  // Start one position before chunk
			for matchStart > 0 && backPos >= 0 {
				if content[matchStart-1] == oldStr[backPos] {
					matchStart--
					backPos--
				} else {
					break
				}
			}

			// Update best match if this one is longer
			if matchLen > bestLen {
				bestStart = matchStart
				bestEnd = matchEnd
				bestLen = matchLen
				
				logger.Debug("Found better match", 
					zap.Int("match_length", matchLen),
					zap.Int("match_start", matchStart),
					zap.Int("match_end", matchEnd))
			}

			// Move start position for next search
			start = idx + 1
		}
	}

	if bestLen >= minMatchLen {
		logger.Debug("Found best match", 
			zap.Int("best_length", bestLen),
			zap.Int("best_start", bestStart),
			zap.Int("best_end", bestEnd))
		return bestStart, bestEnd
	}
	
	logger.Debug("No match found with minimum length",
		zap.Int("best_length", bestLen),
		zap.Int("required_min_length", minMatchLen))
	return -1, -1
}

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, interimContentCh chan string) (string, error) {
	updatedContent := currentContent
	lastActivity := time.Now()

	// Create a goroutine to monitor for activity timeouts and a channel for errors
	// This prevents the LLM from silently stopping and causing a parent timeout
	activityDone := make(chan struct{})
	errCh := make(chan error, 1)

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// If no activity for 2 minutes, consider the LLM stuck
				if time.Since(lastActivity) > 2*time.Minute {
					errMsg := fmt.Sprintf("No activity from LLM for 2 minutes, operation stalled (last activity at %s)",
						lastActivity.Format(time.RFC3339))
					logger.Warn(errMsg)

					// Send error to the error channel and exit
					select {
					case errCh <- fmt.Errorf(errMsg):
					default:
						// Channel already has an error
					}
					return
				}
			case <-activityDone:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	// Make sure to close the activity monitor when we're done
	defer close(activityDone)

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(executePlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	// Add more explicit instructions about the file workflow
	workflowInstructions := `
		Important workflow instructions:
		1. For ANY file operation, ALWAYS use "view" command first to check if a file exists and view its contents.
		2. Only after viewing, decide whether to use "create" (if file doesn't exist) or "str_replace" (if file exists).
		3. Never use "create" on an existing file.
		`

	messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(plan.Description)))

	if actionPlanWithPath.Action == "create" {
		logger.Debug("create file", zap.String("path", actionPlanWithPath.Path))
		createMessage := fmt.Sprintf("Create the file at %s", actionPlanWithPath.Path)
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(workflowInstructions+createMessage)))
	} else if actionPlanWithPath.Action == "update" {
		logger.Debug("update file", zap.String("path", actionPlanWithPath.Path))
		updateMessage := fmt.Sprintf(`The file at %s needs to be updated according to the plan.`,
			actionPlanWithPath.Path)

		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(workflowInstructions+updateMessage)))
	}

	tools := []anthropic.ToolParam{
		{
			Name: anthropic.F(TextEditor_Sonnet35),
			InputSchema: anthropic.F(interface{}(map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{
						"type": "string",
						"enum": []string{"view", "str_replace", "create"},
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

	var disabled anthropic.ThinkingConfigEnabledType
	disabled = "disabled"

	for {
		stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     anthropic.F(Model_Sonnet35),
			MaxTokens: anthropic.F(int64(8192)),
			Messages:  anthropic.F(messages),
			Tools:     anthropic.F(toolUnionParams),
			Thinking: anthropic.F[anthropic.ThinkingConfigParamUnion](anthropic.ThinkingConfigEnabledParam{
				Type: anthropic.F(disabled),
			}),
		})

		message := anthropic.Message{}
		for stream.Next() {
			event := stream.Current()
			err := message.Accumulate(event)
			if err != nil {
				return "", err
			}

			switch event := event.AsUnion().(type) {
			case anthropic.ContentBlockDeltaEvent:
				if event.Delta.Text != "" {
					fmt.Printf("%s", event.Delta.Text)
				}
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

				// Update last activity timestamp on each tool use
				lastActivity = time.Now()

				logger.Info("LLM text_editor tool use",
					zap.String("command", input.Command),
					zap.String("path", input.Path),
					zap.Int("old_str_len", len(input.OldStr)),
					zap.Int("new_str_len", len(input.NewStr)))

				if input.Command == "view" {
					if updatedContent == "" {
						// File doesn't exist yet
						response = "Error: File does not exist. Use create instead."
					} else {
						response = updatedContent
					}
				} else if input.Command == "str_replace" {
					// First check if the string is found in the content for logging
					found := strings.Contains(updatedContent, input.OldStr)

					// Log every str_replace operation, successful or not
					if err := logStrReplaceOperation(ctx, input.Path, input.OldStr, input.NewStr, updatedContent, found); err != nil {
						logger.Warn("str_replace logging failed", zap.Error(err))
					}

					// Perform the actual string replacement with our extracted function
					logger.Debug("performing string replacement")
					newContent, success, replaceErr := PerformStringReplacement(updatedContent, input.OldStr, input.NewStr)
					logger.Debug("string replacement complete", zap.String("success", fmt.Sprintf("%t", success)))

					if !success {
						// Create error message and update the log
						errorMsg := "String to replace not found in file"
						if replaceErr != nil {
							errorMsg = replaceErr.Error()
						}

						// Update the error message in the database
						logger.Debug("updating error message in str_replace log", zap.String("error_msg", errorMsg))
						if err := UpdateStrReplaceLogErrorMessage(ctx, input.Path, input.OldStr, errorMsg); err != nil {
							logger.Warn("Failed to update error message in str_replace log", zap.Error(err))
						}

						response = "Error: String to replace not found in file. Please use smaller, more precise replacements."
					} else {
						updatedContent = newContent

						// Send updated content through the channel
						interimContentCh <- updatedContent
						response = "Content replaced successfully"
					}
				} else if input.Command == "create" {
					if updatedContent != "" {
						response = "Error: File already exists. Use view and str_replace instead."
					} else {
						updatedContent = input.NewStr

						interimContentCh <- updatedContent
						response = "Created"
					}
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

	return updatedContent, nil
}
