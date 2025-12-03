package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
	"go.uber.org/zap"
)

const (
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

func logStrReplaceOperation(ctx context.Context, filePath, oldStr, newStr string, fileContent string, found bool) error {
	if !persistence.IsPoolInitialized() {
		return nil
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	id, err := securerandom.Hex(16)
	if err != nil {
		return fmt.Errorf("failed to generate random ID for str_replace_log: %w", err)
	}

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

	logger.Debug("Logged str_replace operation to database",
		zap.String("id", returnedID),
		zap.String("file_path", filePath),
		zap.Bool("found", found))

	return nil
}

func UpdateStrReplaceLogErrorMessage(ctx context.Context, filePath, oldStr, errorMessage string) error {
	if !persistence.IsPoolInitialized() {
		logger.Debug("Skipping str_replace log update - Postgres not initialized")
		return nil
	}

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

func GetStrReplaceLogs(ctx context.Context, limit int, foundOnly bool, filePath string) ([]StrReplaceLog, error) {
	if !persistence.IsPoolInitialized() {
		return []StrReplaceLog{}, nil
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

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

	rows, err := conn.Query(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query str_replace logs: %w", err)
	}
	defer rows.Close()

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

func GetStrReplaceFailures(ctx context.Context, limit int) ([]StrReplaceLog, error) {
	return GetStrReplaceLogs(ctx, limit, false, "")
}

func PerformStringReplacement(content, oldStr, newStr string) (string, bool, error) {
	startTime := time.Now()
	defer func() {
		logger.Debug("String replacement operation completed", 
			zap.Duration("time_taken", time.Since(startTime)))
	}()
	
	logger.Debug("Starting string replacement", 
		zap.Int("content_size", len(content)), 
		zap.Int("old_string_size", len(oldStr)),
		zap.Int("new_string_size", len(newStr)))
	
	if strings.Contains(content, oldStr) {
		logger.Debug("Found exact match, performing replacement")
		updatedContent := strings.ReplaceAll(content, oldStr, newStr)
		return updatedContent, true, nil
	}
	
	logger.Debug("No exact match found, attempting fuzzy matching")

	ctx, cancel := context.WithTimeout(context.Background(), fuzzyMatchTimeout)
	defer cancel()

	resultCh := make(chan struct {
		start, end int
		err        error
	}, 1)

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

	select {
	case result := <-resultCh:
		if result.err != nil {
			logger.Debug("Fuzzy match failed", zap.Error(result.err))
			return content, false, result.err
		}
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
	if len(oldStr) < minMatchLen {
		logger.Debug("String too small for fuzzy matching", 
			zap.Int("length", len(oldStr)), 
			zap.Int("min_length", minMatchLen))
		return -1, -1
	}

	bestStart := -1
	bestEnd := -1
	bestLen := 0
	
	maxChunks := 100
	chunksProcessed := 0

	for i := 0; i < len(oldStr) && chunksProcessed < maxChunks; i += chunkSize / 2 {
		chunkEnd := i + chunkSize
		if chunkEnd > len(oldStr) {
			chunkEnd = len(oldStr)
		}

		chunk := oldStr[i:chunkEnd]
		
		if len(chunk) < 10 {
			continue
		}
		
		chunksProcessed++
		
		start := 0
		maxOccurrences := 100
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
			
			idx += start

			matchStart := idx
			matchEnd := idx + len(chunk)
			matchLen := len(chunk)
			
			originalI := i

			for matchEnd < len(content) && (i+matchLen) < len(oldStr) {
				if content[matchEnd] == oldStr[i+matchLen] {
					matchEnd++
					matchLen++
				} else {
					break
				}
			}

			backPos := originalI - 1
			for matchStart > 0 && backPos >= 0 {
				if content[matchStart-1] == oldStr[backPos] {
					matchStart--
					backPos--
				} else {
					break
				}
			}

			if matchLen > bestLen {
				bestStart = matchStart
				bestEnd = matchEnd
				bestLen = matchLen
				
				logger.Debug("Found better match", 
					zap.Int("match_length", matchLen),
					zap.Int("match_start", matchStart),
					zap.Int("match_end", matchEnd))
			}

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

	activityDone := make(chan struct{})
	errCh := make(chan error, 1)

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if time.Since(lastActivity) > 2*time.Minute {
					errMsg := fmt.Sprintf("No activity from LLM for 2 minutes, operation stalled (last activity at %s)",
						lastActivity.Format(time.RFC3339))
					logger.Warn(errMsg)

					select {
					case errCh <- fmt.Errorf(errMsg):
					default:
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

	defer close(activityDone)

	messages := []MessageParam{
		{Role: "assistant", Content: executePlanSystemPrompt},
		{Role: "user", Content: detailedPlanInstructions},
	}

	messages = append(messages, MessageParam{Role: "assistant", Content: plan.Description})

	workflowInstructions := `
Important workflow instructions:
1. For ANY file operation, ALWAYS use "view" command first to check if a file exists and view its contents.
2. Only after viewing, decide whether to use "create" (if file doesn't exist) or "str_replace" (if file exists).
3. Never use "create" on an existing file.`

	if actionPlanWithPath.Action == "create" {
		logger.Debug("create file", zap.String("path", actionPlanWithPath.Path))
		createMessage := fmt.Sprintf("Create the file at %s", actionPlanWithPath.Path)
		messages = append(messages, MessageParam{Role: "user", Content: workflowInstructions + createMessage})
	} else if actionPlanWithPath.Action == "update" {
		logger.Debug("update file", zap.String("path", actionPlanWithPath.Path))
		updateMessage := fmt.Sprintf(`The file at %s needs to be updated according to the plan.`,
			actionPlanWithPath.Path)

		messages = append(messages, MessageParam{Role: "user", Content: workflowInstructions + updateMessage})
	}
	
	client := NewNextJSClient()

	for {
		content, toolCalls, err := client.ExecuteAction(ctx, ExecuteActionRequest{
			Messages: messages,
		})
		if err != nil {
			return "", err
		}

		if len(toolCalls) > 0 {
			messages = append(messages, MessageParam{Role: "assistant", Content: content})
		} else if content != "" {
			fmt.Printf("%s", content)
			messages = append(messages, MessageParam{Role: "assistant", Content: content})
			break
		} else {
			break
		}

		for _, tc := range toolCalls {
			lastActivity = time.Now()

			var response interface{}
			var input struct {
				Command string `json:"command"`
				Path    string `json:"path"`
				OldStr  string `json:"old_str"`
				NewStr  string `json:"new_str"`
			}

			if err := json.Unmarshal([]byte(tc.Args), &input); err != nil {
				return "", fmt.Errorf("failed to unmarshal tool input: %w", err)
			}

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
				if input.OldStr == "" {
					response = "Error: old_str cannot be empty. You must specify the text to replace."
					logger.Warn("Rejected str_replace with empty old_str", zap.String("path", input.Path))
				} else {
					found := strings.Contains(updatedContent, input.OldStr)

					if err := logStrReplaceOperation(ctx, input.Path, input.OldStr, input.NewStr, updatedContent, found); err != nil {
						logger.Warn("str_replace logging failed", zap.Error(err))
					}

					logger.Debug("performing string replacement")
					newContent, success, replaceErr := PerformStringReplacement(updatedContent, input.OldStr, input.NewStr)
					logger.Debug("string replacement complete", zap.String("success", fmt.Sprintf("%t", success)))

					if !success {
						errorMsg := "String to replace not found in file"
						if replaceErr != nil {
							errorMsg = replaceErr.Error()
						}

						logger.Debug("updating error message in str_replace log", zap.String("error_msg", errorMsg))
						if err := UpdateStrReplaceLogErrorMessage(ctx, input.Path, input.OldStr, errorMsg); err != nil {
							logger.Warn("Failed to update error message in str_replace log", zap.Error(err))
						}

						response = "Error: String to replace not found in file. Please use smaller, more precise replacements."
					} else {
						updatedContent = newContent
						interimContentCh <- updatedContent
						response = "Content replaced successfully"
					}
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

		var resultMessage string
		switch input.Command {
		case "view":
			if responseStr, ok := response.(string); ok {
				if strings.HasPrefix(responseStr, "Error:") {
					resultMessage = responseStr
				} else {
					resultMessage = fmt.Sprintf("File content of %s:\n```\n%s\n```", input.Path, responseStr)
				}
			} else {
					resultMessage = fmt.Sprintf("File content of %s:\n```\n%v\n```", input.Path, response)
			}
		case "str_replace":
			resultMessage = fmt.Sprintf("%v", response)
		case "create":
			resultMessage = fmt.Sprintf("%v", response)
		default:
			resultMessage = fmt.Sprintf("%v", response)
		}

			messages = append(messages, MessageParam{
				Role:    "user",
				Content: resultMessage,
			})
		}
	}

	return updatedContent, nil
}
