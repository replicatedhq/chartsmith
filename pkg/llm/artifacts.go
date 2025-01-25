package llm

import (
	"context"
	"strings"

	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
)

func parseArtifactsInResponse(response string) ([]types.Artifact, error) {
	parser := NewParser()

	parser.ParseArtifacts(response)

	result := parser.GetResult()

	return result.Artifacts, nil
}

func parseActionsInResponse(response string) (map[string]types.ActionPlan, error) {
	parser := NewParser()

	parser.ParsePlan(response)

	result := parser.GetResult()

	return result.Actions, nil
}

func removeChartsmithTags(ctx context.Context, input string) string {
	artifactStart := strings.Index(input, "<chartsmithArtifact")
	if artifactStart == -1 {
		return input
	}

	// Get everything before first chartsmith tag
	result := input[:artifactStart]

	// Find last chartsmith tag
	lastArtifactEnd := strings.LastIndex(input, "</chartsmithArtifact>")
	if lastArtifactEnd != -1 {
		// Add everything after the last closing tag
		result += input[lastArtifactEnd+len("</chartsmithArtifact>"):]
	}

	return result
}
