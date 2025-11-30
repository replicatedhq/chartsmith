package llm

import (
	"context"
	"fmt"
	"log"
	"strings"

	openai "github.com/sashabaranov/go-openai"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

// CreatePlanOpenRouter creates a plan using OpenRouter
func CreatePlanOpenRouter(ctx context.Context, streamCh chan string, doneCh chan error, opts CreatePlanOpts) error {
	fileNameArgs := []string{}
	for _, file := range opts.RelevantFiles {
		fileNameArgs = append(fileNameArgs, file.FilePath)
	}
	logger.Debug("Creating plan with OpenRouter",
		zap.Int("relevantFiles", len(opts.RelevantFiles)),
		zap.String("relevantFiles", strings.Join(fileNameArgs, ", ")),
		zap.Bool("isUpdate", opts.IsUpdate),
	)

	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	messages := []openai.ChatCompletionMessage{}

	if !opts.IsUpdate {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleSystem,
			Content: commonSystemPrompt,
		})
	} else {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleSystem,
			Content: updatePlanSystemPrompt,
		})
	}

	// Build chart context
	chartStructure, err := getChartStructure(ctx, opts.Chart)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure),
	})

	// Add relevant files
	for _, file := range opts.RelevantFiles {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content),
		})
	}

	// Add chat messages
	for _, chat := range opts.ChatMessages {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: chat.Prompt,
		})
	}

	client.StreamChatCompletion(ctx, messages, streamCh, doneCh)
	return nil
}

// CreateInitialPlanOptsOpenRouter creates an initial plan using OpenRouter
func CreateInitialPlanOptsOpenRouter(ctx context.Context, streamCh chan string, doneCh chan error, opts CreateInitialPlanOpts) error {
	log.Printf("[OpenRouter] Creating initial plan")
	
	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: initialPlanSystemPrompt + "\n\n" + initialPlanInstructions,
		},
	}

	// Add bootstrap chart summary
	bootstrapSummary, err := summarizeBootstrapChartOpenRouter(ctx)
	if err != nil {
		return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
	}
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: bootstrapSummary,
	})

	// Add chat messages
	for _, chatMessage := range opts.ChatMessages {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: chatMessage.Prompt,
		})
		if chatMessage.Response != "" {
			messages = append(messages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleAssistant,
				Content: chatMessage.Response,
			})
		}
	}

	// Add additional files
	for _, additionalFile := range opts.AdditionalFiles {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: additionalFile.Content,
		})
	}

	// Add final instruction
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: "Describe the plan only (do not write code) to create a helm chart based on the previous discussion.",
	})

	client.StreamChatCompletion(ctx, messages, streamCh, doneCh)
	return nil
}

// CreateExecutePlanOpenRouter creates an execution plan using OpenRouter
func CreateExecutePlanOpenRouter(ctx context.Context, planActionCreatedCh chan types.ActionPlanWithPath, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan, c *workspacetypes.Chart, relevantFiles []workspacetypes.File) error {
	logger.Debug("Creating execution plan with OpenRouter",
		zap.String("workspace_id", w.ID),
		zap.String("chart_id", c.ID),
		zap.Int("revision_number", w.CurrentRevision),
		zap.Int("relevant_files_len", len(relevantFiles)),
	)

	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: detailedPlanSystemPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: detailedPlanInstructions,
		},
	}

	if w.CurrentRevision == 0 {
		bootstrapSummary, err := summarizeBootstrapChartOpenRouter(ctx)
		if err != nil {
			return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
		}
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: bootstrapSummary,
		})
	} else {
		chartStructure, err := getChartStructure(ctx, c)
		if err != nil {
			return fmt.Errorf("failed to get chart structure: %w", err)
		}
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure),
		})

		for _, file := range relevantFiles {
			messages = append(messages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleUser,
				Content: fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content),
			})
		}
	}

	// Add plan description
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: plan.Description,
	})

	// Stream and parse for action tags
	fullResponseWithTags := ""
	actionPlans := make(map[string]types.ActionPlan)
	
	// Create internal channels for streaming
	internalStreamCh := make(chan string, 10)
	internalDoneCh := make(chan error, 1)
	
	// Start streaming in a goroutine
	go func() {
		client.StreamChatCompletion(ctx, messages, internalStreamCh, internalDoneCh)
	}()
	
	// Process stream chunks
	done := false
	for !done {
		select {
		case chunk := <-internalStreamCh:
			fullResponseWithTags += chunk
			
			// Parse for action tags (same as Anthropic version)
			aps, err := parseActionsInResponse(fullResponseWithTags)
			if err != nil {
				logger.Warn("Error parsing actions in response",
					zap.Error(err))
				continue
			}
			
			for path, action := range aps {
				// Only add if the full struct is there
				if path != "" && action.Type != "" && action.Action != "" {
					// If the item is not already in the map, emit it
					if _, ok := actionPlans[path]; !ok {
						action.Status = types.ActionPlanStatusPending
						actionPlanWithPath := types.ActionPlanWithPath{
							Path:       path,
							ActionPlan: action,
						}
						logger.Debug("[OpenRouter Execute Plan] Emitting action",
							zap.String("path", path),
							zap.String("action", action.Action))
						planActionCreatedCh <- actionPlanWithPath
					}
					
					actionPlans[path] = action
				}
			}
			
			// Also forward to the original stream channel
			streamCh <- chunk
			
		case err := <-internalDoneCh:
			done = true
			logger.Info("[OpenRouter Execute Plan] Streaming complete",
				zap.Int("total_actions", len(actionPlans)))
			doneCh <- err
		}
	}
	
	return nil
}

// SummarizeBootstrapChartOpenRouter summarizes the bootstrap chart using OpenRouter
func summarizeBootstrapChartOpenRouter(ctx context.Context) (string, error) {
	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	bootstrapWorkspace, err := workspace.GetBootstrapWorkspace(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get bootstrap workspace: %w", err)
	}

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: "You are a helpful assistant that summarizes Helm chart structures.",
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: "Please summarize the following bootstrap Helm chart files:",
		},
	}

	if len(bootstrapWorkspace.Charts) > 0 {
		for _, file := range bootstrapWorkspace.Charts[0].Files {
			messages = append(messages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleUser,
				Content: fmt.Sprintf(`File: %s\nContent: %s`, file.FilePath, file.Content),
			})
		}
	}

	summary, err := client.ChatCompletion(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("failed to summarize: %w", err)
	}

	return summary, nil
}

// ConvertFileOpenRouter converts a file using OpenRouter
func ConvertFileOpenRouter(ctx context.Context, fileContent string, fileName string) (string, error) {
	log.Printf("[OpenRouter] Converting file: %s", fileName)
	
	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: "You are a Helm chart expert. Convert the following Kubernetes manifest to Helm template format.",
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: fmt.Sprintf("File: %s\n\nContent:\n%s", fileName, fileContent),
		},
	}

	result, err := client.ChatCompletion(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("failed to convert file: %w", err)
	}

	return result, nil
}

// CleanupConvertedValuesOpenRouter cleans up converted values using OpenRouter  
func CleanupConvertedValuesOpenRouter(ctx context.Context, valuesYAML string) (string, error) {
	log.Printf("[OpenRouter] Cleaning up converted values")
	
	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: cleanupConvertedValuesSystemPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: fmt.Sprintf("Here is the converted values.yaml file:\n---\n%s\n---\n", valuesYAML),
		},
	}

	result, err := client.ChatCompletion(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("failed to cleanup values: %w", err)
	}

	// Parse artifacts from response
	artifacts, err := parseArtifactsInResponse(result)
	if err != nil {
		return "", fmt.Errorf("failed to parse artifacts: %w", err)
	}

	if len(artifacts) == 0 {
		return "", fmt.Errorf("no artifacts found in response")
	}

	// Return the first artifact content
	for _, artifact := range artifacts {
		return artifact.Content, nil
	}

	return "", fmt.Errorf("no valid artifact found")
}

// summarizeContentWithOpenRouter summarizes content using OpenRouter
func summarizeContentWithOpenRouter(ctx context.Context, content string) (string, error) {
	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	userMessage := "My helm chart includes the following file. Summarize it, including all names, variables, etc that it uses: " + content

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleUser,
			Content: userMessage,
		},
	}

	result, err := client.ChatCompletion(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("failed to summarize content: %w", err)
	}

	return result, nil
}

// ExecuteActionOpenRouter executes a file action using OpenRouter
// Simplified version that generates complete file content
func ExecuteActionOpenRouter(ctx context.Context, actionPlanWithPath types.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, interimContentCh chan string) (string, error) {
	logger.Info("[OpenRouter Execute Action] Starting",
		zap.String("path", actionPlanWithPath.Path),
		zap.String("action", actionPlanWithPath.Action))
	
	client, err := newOpenRouterClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenRouter client: %w", err)
	}

	var messages []openai.ChatCompletionMessage

	if actionPlanWithPath.Action == "create" {
		// For create actions, generate the full file content
		messages = []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: "You are an expert Kubernetes and Helm chart developer. Generate complete, valid file content according to the plan.",
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: fmt.Sprintf("Create a new file at path: %s\n\nPlan description:\n%s\n\nGenerate the complete file content. Output ONLY the raw file content without any explanations, markdown code blocks, or additional text.", 
					actionPlanWithPath.Path, plan.Description),
			},
		}
	} else if actionPlanWithPath.Action == "update" {
		// For update actions, provide current content and ask for updated version
		messages = []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: "You are an expert Kubernetes and Helm chart developer. Update file content according to the plan while preserving existing structure where appropriate.",
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: fmt.Sprintf("Update the file at path: %s\n\nCurrent content:\n---\n%s\n---\n\nPlan description:\n%s\n\nGenerate the complete updated file content. Output ONLY the raw file content without any explanations, markdown code blocks, or additional text.",
					actionPlanWithPath.Path, currentContent, plan.Description),
			},
		}
	} else if actionPlanWithPath.Action == "delete" {
		// For delete actions, just return empty string
		logger.Info("[OpenRouter Execute Action] Delete action - returning empty content")
		return "", nil
	} else {
		return "", fmt.Errorf("unsupported action: %s", actionPlanWithPath.Action)
	}

	// Use non-streaming completion for simplicity
	result, err := client.ChatCompletion(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("failed to execute action: %w", err)
	}

	// Clean up any markdown code blocks if present
	result = strings.TrimSpace(result)
	result = strings.TrimPrefix(result, "```yaml")
	result = strings.TrimPrefix(result, "```")
	result = strings.TrimSuffix(result, "```")
	result = strings.TrimSpace(result)

	logger.Info("[OpenRouter Execute Action] Completed",
		zap.String("path", actionPlanWithPath.Path),
		zap.Int("content_length", len(result)))

	return result, nil
}

