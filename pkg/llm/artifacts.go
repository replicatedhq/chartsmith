package llm

import (
	"context"
	"strings"

	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func parseArtifactsInResponse(response string) (string, []workspacetypes.File, error) {
	parser := NewParser()

	parser.Parse(response)

	result := parser.GetResult()

	files := []workspacetypes.File{}
	for _, file := range result.Files {
		f := workspacetypes.File{
			FilePath: file.Path,
		}

		if file.Content != "" {
			f.Content = file.Content
		} else {
			f.Content = file.PartialContent
		}

		files = append(files, f)
	}

	return result.Title, files, nil
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
