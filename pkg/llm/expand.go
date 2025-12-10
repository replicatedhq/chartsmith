package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

// ExpandPrompt expands a user prompt by adding specific search terms and Kubernetes GVKs
// to improve relevance when searching through existing Helm chart files.
func ExpandPrompt(ctx context.Context, prompt string) (string, error) {
	logger.Debug("ExpandPrompt", zap.String("prompt", prompt))

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create anthropic client: %w", err)
	}

	userMessage := fmt.Sprintf(`The following question is about developing a Helm chart.
There is an existing chart that we will be editing.
Look at the question, and help decide how to determine the existing files that are relevant to the question.
Try to structure the terms to be as specific as possible to avoid nearby matches.

To do this, take the prompt below, and expand it to include specific terms that we should search for in the existing chart.

If there are Kubernetes GVKs that are relevant to the question, include them prominently in the expanded prompt.

The expanded prompt should be a single paragraph, and should be no more than 100 words.

Here is the prompt:

%s
	`, prompt)

	resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(DefaultModel),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F([]anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage))}),
	})
	if err != nil {
		logger.Errorf("Failed to call Anthropic API: %v", err)
		return "", fmt.Errorf("failed to call Anthropic API: %w", err)
	}

	// Validate response structure
	if resp == nil {
		logger.Errorf("Received nil response from Anthropic API")
		return "", fmt.Errorf("received nil response from Anthropic API")
	}

	if len(resp.Content) == 0 {
		logger.Errorf("Received empty content from Anthropic API")
		return "", fmt.Errorf("received empty content from Anthropic API")
	}

	expandedPrompt := resp.Content[0].Text
	logger.Debug("ExpandPrompt result", zap.String("expandedPrompt", expandedPrompt))

	return expandedPrompt, nil
}
