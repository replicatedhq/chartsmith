package llm

import (
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
