package llm

import (
	"context"
	"encoding/json"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/recommendations"
)

// ExecuteToolAndStream executes a tool and streams the result in AI SDK format.
//
// Note: The tool call start and argument deltas are already streamed during
// the initial Anthropic stream in StreamConversationalChatAISDK. This function
// only executes the tool and streams the result.
//
// Supported tools:
//   - latest_subchart_version: Gets latest version of a subchart from Artifact Hub
//   - latest_kubernetes_version: Gets latest Kubernetes version (major/minor/patch)
//
// Parameters:
//   - ctx: Context for cancellation
//   - writer: AISDKStreamWriter for streaming tool result
//   - toolUse: Tool use block from Anthropic containing tool name and arguments
//
// Returns the result as a JSON string for use in continuing the conversation.
// Returns an error if tool execution fails or streaming fails.
func ExecuteToolAndStream(
	ctx context.Context,
	writer *AISDKStreamWriter,
	toolUse anthropic.ToolUseBlock,
) (string, error) {
	// Parse tool input
	var input map[string]interface{}
	if err := json.Unmarshal(toolUse.Input, &input); err != nil {
		return "", fmt.Errorf("failed to parse tool input: %w", err)
	}

	// Note: Tool call start and deltas are already streamed during the initial Anthropic stream
	// in StreamConversationalChatAISDK. We only need to execute the tool and stream the result here.

	// Execute tool based on name
	var result interface{}
	var err error

	switch toolUse.Name {
	case "latest_subchart_version":
		chartName, ok := input["chart_name"].(string)
		if !ok {
			return "", fmt.Errorf("chart_name is required and must be string")
		}

		version, err := recommendations.GetLatestSubchartVersion(chartName)
		if err == recommendations.ErrNoArtifactHubPackage {
			result = "?"
		} else if err != nil {
			result = map[string]string{"error": err.Error()}
		} else {
			result = version
		}

	case "latest_kubernetes_version":
		semverField, _ := input["semver_field"].(string)
		switch semverField {
		case "major":
			result = "1"
		case "minor":
			result = "1.32"
		case "patch":
			result = "1.32.1"
		default:
			result = "1.32.1" // Default to patch
		}

	default:
		err = fmt.Errorf("unknown tool: %s", toolUse.Name)
		result = map[string]string{"error": err.Error()}
	}

	// Stream tool result
	if err := writer.WriteToolResult(toolUse.ID, result); err != nil {
		return "", fmt.Errorf("failed to stream tool result: %w", err)
	}

	// Return result for conversation continuation
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal result: %w", err)
	}

	return string(resultBytes), nil
}
