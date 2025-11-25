package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/jpoz/groq"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/sourcegraph/go-diff/diff"
	"go.uber.org/zap"
	"gopkg.in/yaml.v3"
)

type ConvertFileOpts struct {
	Path       string
	Content    string
	ValuesYAML string
}

// ConvertFile is sync and will return a map of path:content
func ConvertFile(ctx context.Context, opts ConvertFileOpts) (map[string]string, string, error) {
	logger.Info("Converting file",
		zap.String("path", opts.Path),
	)

	// Use Claude instead of Groq for consistency and reliability
	return convertFileUsingClaude(ctx, opts)
}

func convertFileUsingGroq(ctx context.Context, opts ConvertFileOpts) (map[string]string, string, error) {
	client := groq.NewClient(groq.WithAPIKey(param.Get().GroqAPIKey))

	messages := []groq.Message{
		{
			Role:    "system",
			Content: executePlanSystemPrompt,
		},
		{
			Role:    "system",
			Content: convertFileSystemPrompt,
		},
		{
			Role: "user",
			Content: fmt.Sprintf(`
Here is the existing values.yaml file:
---
%s
---
			`, opts.ValuesYAML),
		},
		{
			Role: "user",
			Content: fmt.Sprintf(`
Convert the following Kubernetes manifest to a helm template:
---
%s
---
			`, opts.Content),
		},
	}

	response, err := client.CreateChatCompletion(groq.CompletionCreateParams{
		Model:    "llama-3.3-70b-versatile",
		Messages: messages,
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to get converted file content: %w", err)
	}

	artifacts, err := parseArtifactsInResponse(response.Choices[0].Message.Content)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse artifacts: %w", err)
	}

	updatedValuesYAML := opts.ValuesYAML
	artifactsMap := make(map[string]string)
	for _, artifact := range artifacts {
		if artifact.Path == "values.yaml" {
			// Check if the content is a unified diff patch
			if strings.HasPrefix(strings.TrimSpace(artifact.Content), "---") &&
				strings.Contains(artifact.Content, "+++") &&
				strings.Contains(artifact.Content, "@@") {
				// It's a patch, try to apply it safely
				logger.Info("Received values.yaml as a patch, attempting to apply")

				// Try to apply the patch
				newContent, err := applyPatch(opts.ValuesYAML, artifact.Content)
				if err != nil {
					// Patch application failed, fall back to merging approach
					logger.Warn("Failed to apply patch directly, falling back to content extraction", zap.Error(err))

					// Extract and merge the added content from the patch
					extractedContent := extractAddedContent(artifact.Content)
					mergedValues, err := mergeValuesYAML(opts.ValuesYAML, extractedContent)
					if err != nil {
						logger.Warn("Failed to merge values.yaml, using original content", zap.Error(err))
					} else {
						updatedValuesYAML = mergedValues
					}
				} else {
					// Patch applied successfully
					updatedValuesYAML = newContent
				}
			} else {
				// It's not a patch, use the normal merging approach
				mergedValues, err := mergeValuesYAML(opts.ValuesYAML, artifact.Content)
				if err != nil {
					logger.Warn("Failed to merge values.yaml, using original content", zap.Error(err))
				} else {
					updatedValuesYAML = mergedValues
				}
			}
		} else {
			artifactsMap[artifact.Path] = artifact.Content
		}
	}

	return artifactsMap, updatedValuesYAML, nil
}

func convertFileUsingClaude(ctx context.Context, opts ConvertFileOpts) (map[string]string, string, error) {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get anthropic client: %w", err)
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(executePlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(convertFileSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`
Here is the existing values.yaml file:
---
%s
---
			`, opts.ValuesYAML)),
		),
		anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`
Convert the following Kubernetes manifest to a helm template:
---
%s
---
			`, opts.Content)),
		),
	}

	response, err := client.Messages.New(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Haiku20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to create message: %w", err)
	}

	artifacts, err := parseArtifactsInResponse(response.Content[0].Text)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse artifacts: %w", err)
	}

	updatedValuesYAML := opts.ValuesYAML
	artifactsMap := make(map[string]string)
	for _, artifact := range artifacts {
		if artifact.Path == "values.yaml" {
			// Check if the content is a unified diff patch
			if strings.HasPrefix(strings.TrimSpace(artifact.Content), "---") &&
				strings.Contains(artifact.Content, "+++") &&
				strings.Contains(artifact.Content, "@@") {
				// It's a patch, try to apply it safely
				logger.Info("Received values.yaml as a patch, attempting to apply")

				// Try to apply the patch
				newContent, err := applyPatch(opts.ValuesYAML, artifact.Content)
				if err != nil {
					// Patch application failed, fall back to merging approach
					logger.Warn("Failed to apply patch directly, falling back to content extraction", zap.Error(err))

					// Extract and merge the added content from the patch
					extractedContent := extractAddedContent(artifact.Content)
					mergedValues, err := mergeValuesYAML(opts.ValuesYAML, extractedContent)
					if err != nil {
						logger.Warn("Failed to merge values.yaml, using original content", zap.Error(err))
					} else {
						updatedValuesYAML = mergedValues
					}
				} else {
					// Patch applied successfully
					updatedValuesYAML = newContent
				}
			} else {
				// It's not a patch, use the normal merging approach
				mergedValues, err := mergeValuesYAML(opts.ValuesYAML, artifact.Content)
				if err != nil {
					logger.Warn("Failed to merge values.yaml, using original content", zap.Error(err))
				} else {
					updatedValuesYAML = mergedValues
				}
			}
		} else {
			artifactsMap[artifact.Path] = artifact.Content
		}
	}

	return artifactsMap, updatedValuesYAML, nil
}

// applyPatch attempts to apply a unified diff patch to the original content
func applyPatch(original, patchContent string) (string, error) {
	// Parse the patch
	fileDiffs, err := diff.ParseMultiFileDiff([]byte(patchContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse patch: %w", err)
	}

	if len(fileDiffs) == 0 {
		return "", fmt.Errorf("no file diffs found in patch")
	}

	// Apply the first file diff (should be values.yaml)
	fileDiff := fileDiffs[0]

	// Split the original content into lines
	originalLines := strings.Split(original, "\n")

	// Apply each hunk
	result := make([]string, len(originalLines))
	copy(result, originalLines)

	for _, hunk := range fileDiff.Hunks {
		// Calculate the start line in the result
		startLine := int(hunk.OrigStartLine) - 1
		if startLine < 0 {
			startLine = 0
		}

		// If the start line is beyond the end of the file, append empty lines
		for len(result) <= startLine {
			result = append(result, "")
		}

		// Parse the hunk body
		hunkLines := strings.Split(string(hunk.Body), "\n")

		// Apply the changes
		resultIdx := startLine
		for _, line := range hunkLines {
			if line == "" && len(hunkLines) > 0 && hunkLines[len(hunkLines)-1] == "" {
				// Skip empty line at the end of the hunk
				continue
			}

			if len(line) > 0 {
				switch line[0] {
				case '+': // Added line
					// Insert the new line (without the '+')
					if resultIdx >= len(result) {
						result = append(result, line[1:])
					} else {
						result = append(result[:resultIdx+1], result[resultIdx:]...)
						result[resultIdx] = line[1:]
					}
					resultIdx++
				case '-': // Removed line
					// Remove the line if it exists
					if resultIdx < len(result) {
						result = append(result[:resultIdx], result[resultIdx+1:]...)
					}
				case ' ': // Context line
					// Move to the next line
					resultIdx++
				}
			}
		}
	}

	return strings.Join(result, "\n"), nil
}

// extractAddedContent extracts only the added content from a patch
func extractAddedContent(patchContent string) string {
	lines := strings.Split(patchContent, "\n")
	var contentLines []string

	// Skip header lines
	inHunk := false
	for _, line := range lines {
		if strings.HasPrefix(line, "@@") {
			inHunk = true
			continue
		}

		if !inHunk {
			continue
		}

		if strings.HasPrefix(line, "+") && !strings.HasPrefix(line, "+++") {
			contentLines = append(contentLines, line[1:])
		}
	}

	return strings.Join(contentLines, "\n")
}

// mergeValuesYAML merges the new values into the existing values
func mergeValuesYAML(existingYAML, newYAML string) (string, error) {
	// Check if the newYAML is empty
	if strings.TrimSpace(newYAML) == "" {
		return existingYAML, nil
	}

	// Try to parse both as YAML to see if they're valid
	var existingValues, newValues map[string]interface{}
	existingErr := yaml.Unmarshal([]byte(existingYAML), &existingValues)
	newErr := yaml.Unmarshal([]byte(newYAML), &newValues)

	// If either isn't valid YAML or is null after parsing, treat as text
	if existingErr != nil || newErr != nil || existingValues == nil || newValues == nil {
		logger.Info("One or both YAML files couldn't be parsed as maps, treating as text")
		// Simple text append with a separator if both have content
		if strings.TrimSpace(existingYAML) != "" && strings.TrimSpace(newYAML) != "" {
			return existingYAML + "\n# Added by conversion\n" + newYAML, nil
		}
		// If existing is empty, just use new
		if strings.TrimSpace(existingYAML) == "" {
			return newYAML, nil
		}
		// Otherwise return existing
		return existingYAML, nil
	}

	// If we get here, both are valid YAML maps, so do the normal merge
	// If existing values is nil, initialize it
	if existingValues == nil {
		existingValues = make(map[string]interface{})
	}

	// Merge new values into existing values
	for k, v := range newValues {
		existingValues[k] = v
	}

	// Marshal back to YAML
	mergedYAML, err := yaml.Marshal(existingValues)
	if err != nil {
		return "", fmt.Errorf("failed to marshal merged values: %w", err)
	}

	return string(mergedYAML), nil
}
