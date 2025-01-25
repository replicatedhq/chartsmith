package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func CreateDetailedPlan(ctx context.Context, planActionCreatedCh chan types.ActionPlanWithPath, streamCh chan string, doneCh chan error, plan *workspacetypes.Plan) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(detailedPlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	bootsrapChartUserMessage, err := summarizeBootstrapChart(ctx)
	if err != nil {
		return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
	}
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(bootsrapChartUserMessage)))

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(plan.Description)))

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})

	fullResponseWithTags := ""
	actionPlans := make(map[string]types.ActionPlan)

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

	// mark the plan as complete so that the action executors can know when the final step is and mark the plan status as complete
	if err := workspace.SetPlanIsComplete(ctx, plan.ID, true); err != nil {
		return fmt.Errorf("failed to mark plan as complete: %w", err)
	}

	return nil
}
