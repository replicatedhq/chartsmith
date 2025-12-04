package llm

import (
	"context"
	"fmt"

	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

func CreateExecutePlan(ctx context.Context, planActionCreatedCh chan types.ActionPlanWithPath, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan, c *workspacetypes.Chart, relevantFiles []workspacetypes.File, modelID string) error {
	logger.Debug("Creating execution plan",
		zap.String("workspace_id", w.ID),
		zap.String("chart_id", c.ID),
		zap.Int("revision_number", w.CurrentRevision),
		zap.Int("relevant_files_len", len(relevantFiles)),
		zap.String("model_id", modelID),
	)

	// Build messages array for Vercel AI SDK
	messages := []MessageParam{
		{Role: "assistant", Content: detailedPlanSystemPrompt},
		{Role: "user", Content: detailedPlanInstructions},
	}

	if w.CurrentRevision == 0 {
		bootstrapChartUserMessage, err := summarizeBootstrapChart(ctx)
		if err != nil {
			return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
		}
		messages = append(messages, MessageParam{Role: "user", Content: bootstrapChartUserMessage})
	} else {
		chartStructure, err := getChartStructure(ctx, c)
		if err != nil {
			return fmt.Errorf("failed to get chart structure: %w", err)
		}
		messages = append(messages, MessageParam{Role: "user", Content: fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure)})

		for _, file := range relevantFiles {
			messages = append(messages, MessageParam{Role: "user", Content: fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content)})
		}
	}

	messages = append(messages, MessageParam{Role: "user", Content: plan.Description})

	// Use Next.js client (which uses Vercel AI SDK)
	client := NewNextJSClient()
	textCh, errCh := client.StreamPlan(ctx, PlanRequest{
		Messages:    messages,
		WorkspaceID: w.ID,
		ModelID:     modelID,
	})

	fullResponseWithTags := ""
	actionPlans := make(map[string]types.ActionPlan)

	// Handle streaming response
	go func() {
		for {
			select {
			case text, ok := <-textCh:
				if !ok {
					// Channel closed, check for error or signal success
					select {
					case err := <-errCh:
						doneCh <- err
					default:
						// No error, stream completed successfully
						doneCh <- nil
					}
					return
				}
				
				fullResponseWithTags += text

				aps, err := parseActionsInResponse(fullResponseWithTags)
				if err != nil {
					doneCh <- fmt.Errorf("error parsing artifacts in response: %w", err)
					return
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
				
			case err := <-errCh:
				doneCh <- err
				return
			case <-ctx.Done():
				doneCh <- ctx.Err()
				return
			}
		}
	}()

	return nil
}
