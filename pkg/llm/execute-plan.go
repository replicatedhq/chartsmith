package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

const (
	// DefaultPlanModel is the default Claude model used for plan execution
	// Currently using Claude 3.7 Sonnet for better plan generation
	DefaultPlanModel = "claude-3-7-sonnet-20250219"
)

// CreateExecutePlan creates a detailed execution plan for a given workspace plan by streaming
// a request to Claude. The plan is broken down into specific file actions (create/update) that
// are streamed back to the caller as they are generated.
// Parameters:
//   - ctx: context for cancellation
//   - planActionCreatedCh: channel to send each action plan as it's parsed from the response
//   - streamCh: channel for streaming text updates (currently unused but available for future use)
//   - doneCh: channel to signal completion or error
//   - w: the workspace being worked on
//   - plan: the high-level plan to execute
//   - c: the chart being modified
//   - relevantFiles: files that are relevant to this plan (for context)
// Returns an error if plan creation fails, or nil if successful (also sends nil to doneCh on success).
func CreateExecutePlan(ctx context.Context, planActionCreatedCh chan types.ActionPlanWithPath, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan, c *workspacetypes.Chart, relevantFiles []workspacetypes.File) error {
	logger.Debug("Creating execution plan",
		zap.String("workspace_id", w.ID),
		zap.String("chart_id", c.ID),
		zap.Int("revision_number", w.CurrentRevision),
		zap.Int("relevant_files_len", len(relevantFiles)),
	)

	// Initialize Anthropic client for LLM API calls
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create Anthropic client: %w", err)
	}

	// Build conversation history with system prompt and instructions
	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(detailedPlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	// Handle bootstrap vs. existing chart scenarios
	if w.CurrentRevision == 0 {
		bootsrapChartUserMessage, err := summarizeBootstrapChart(ctx)
		if err != nil {
			return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
		}
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(bootsrapChartUserMessage)))
	} else {
		chartStructure, err := getChartStructure(ctx, c)
		if err != nil {
			return fmt.Errorf("failed to get chart structure: %w", err)
		}
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure))))

		for _, file := range relevantFiles {
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content))))
		}
	}

	// Add the user's plan description as the final message
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(plan.Description)))

	// Stream the LLM response to generate the execution plan
	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(DefaultPlanModel),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})

	// Track the full response and parsed action plans
	fullResponseWithTags := ""
	actionPlans := make(map[string]types.ActionPlan)

	// Process streaming events and parse action plans incrementally
	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				fullResponseWithTags += delta.Text

				aps, err := parseActionsInResponse(fullResponseWithTags)
				if err != nil {
					return fmt.Errorf("error parsing artifacts in response: %w", err)
				}

				for path, action := range aps {
					// only add if the full struct is there
					if path != "" && action.Type != "" && action.Action != "" {
						// if the item is not already in the map, we need to stream it back to the caller
						if _, ok := actionPlans[path]; !ok {
							action.Status = types.ActionPlanStatusPending
							actionPlanWithPath := types.ActionPlanWithPath{
								Path:       path,
								ActionPlan: action,
							}
							planActionCreatedCh <- actionPlanWithPath
						}

						actionPlans[path] = action
					}
				}
			}
		}
	}

	if stream.Err() != nil {
		doneCh <- stream.Err()
	}

	doneCh <- nil

	// The plan will be set to "applied" status when all actions are complete

	return nil
}
