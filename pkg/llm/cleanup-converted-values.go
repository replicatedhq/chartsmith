package llm

import (
	"context"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

func CleanUpConvertedValuesYAML(ctx context.Context, valuesYAML string) (string, error) {
	logger.Info("Cleaning up converted values.yaml")

	// Use Next.js client (which uses Vercel AI SDK)
	client := NewNextJSClient()
	
	cleanedText, err := client.CleanupValues(ctx, CleanupValuesRequest{
		ValuesYAML: valuesYAML,
	})
	if err != nil {
		return "", fmt.Errorf("failed to cleanup values via Next.js API: %w", err)
	}

	// Parse artifacts from the response
	artifacts, err := parseArtifactsInResponse(cleanedText)
	if err != nil {
		return "", fmt.Errorf("failed to parse artifacts: %w", err)
	}

	if len(artifacts) == 0 {
		return "", fmt.Errorf("no artifacts found in response")
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
					return artifact.Content, nil
				}

				return newContent, nil
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

	return "", fmt.Errorf("no values.yaml artifact found in response")
}
