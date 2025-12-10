package llm

import (
	"context"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

func CleanUpConvertedValuesYAML(ctx context.Context, valuesYAML string, modelID string) (string, error) {
	logger.Info("Cleaning up converted values.yaml", zap.String("model_id", modelID))

	// Use Next.js client (which uses Vercel AI SDK)
	client := NewNextJSClient()

	// Build messages with system prompt from Go
	messages := []MessageParam{
		{Role: "assistant", Content: cleanupConvertedValuesSystemPrompt},
		{Role: "user", Content: fmt.Sprintf("Here is the converted values.yaml file:\n---\n%s\n---", valuesYAML)},
	}

	cleanedText, err := client.CleanupValues(ctx, CleanupValuesRequest{
		ValuesYAML: valuesYAML,
		ModelID:    modelID,
		Messages:   messages,
	})
	if err != nil {
		return "", fmt.Errorf("failed to cleanup values via Next.js API: %w", err)
	}

	// Parse artifacts from the response
	artifacts, err := parseArtifactsInResponse(cleanedText)
	if err != nil {
		return "", fmt.Errorf("failed to parse artifacts: %w", err)
	}

	// If no artifacts found, the LLM might have returned the cleaned YAML directly
	// without wrapping it in artifact tags. Use the response as-is.
	if len(artifacts) == 0 {
		logger.Info("No artifacts found in cleanup response, using response directly")
		return cleanedText, nil
	}

	for _, artifact := range artifacts {
		if artifact.Path == "values.yaml" {
			if strings.HasPrefix(strings.TrimSpace(artifact.Content), "---") &&
				strings.Contains(artifact.Content, "+++") &&
				strings.Contains(artifact.Content, "@@") {
				// It's a patch, try to apply it safely
				logger.Info("Received values.yaml as a patch, attempting to apply")

				// Try to apply the patch
				newContent, err := applyPatch(valuesYAML, artifact.Content)
				if err != nil {
					// Patch application failed, fall back to merging approach
					logger.Warn("Failed to apply patch directly, falling back to content extraction", zap.Error(err))

					// Extract and merge the added content from the patch
					extractedContent := extractAddedContent(artifact.Content)
					mergedValues, err := mergeValuesYAML(valuesYAML, extractedContent)
					if err != nil {
						logger.Warn("Failed to merge values.yaml, using original content", zap.Error(err))
					} else {
						return mergedValues, nil
					}
				} else {
					return newContent, nil
				}
			} else {
				// It's not a patch, use the normal merging approach
				mergedValues, err := mergeValuesYAML(valuesYAML, artifact.Content)
				if err != nil {
					logger.Warn("Failed to merge values.yaml, using original content", zap.Error(err))
				} else {
					return mergedValues, nil
				}
			}
		}
	}

	// If we found artifacts but none were values.yaml, use the cleaned text directly
	logger.Warn("No values.yaml artifact found in response, using response directly")
	return cleanedText, nil
}
