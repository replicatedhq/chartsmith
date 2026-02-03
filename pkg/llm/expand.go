package llm

import (
	"context"
	"fmt"
	"os"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/llm/claude"
)

func ExpandPrompt(ctx context.Context, prompt string) (string, error) {
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

	// Use Claude service if CLAUDE_SERVICE_URL is set
	if os.Getenv("CLAUDE_SERVICE_URL") != "" {
		return expandPromptViaService(ctx, userMessage)
	}

	return expandPromptDirect(ctx, userMessage)
}

// expandPromptViaService uses the Node.js Claude service
func expandPromptViaService(ctx context.Context, userMessage string) (string, error) {
	client := claude.NewClient()

	resp, err := client.CreateMessage(ctx, &claude.Request{
		Model:     claude.ModelClaude37Sonnet,
		MaxTokens: 8192,
		Messages: []claude.Message{
			{
				Role:    "user",
				Content: userMessage,
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to call Claude service: %w", err)
	}

	if resp == nil {
		return "", fmt.Errorf("received nil response from Claude service")
	}

	if len(resp.Content) == 0 {
		return "", fmt.Errorf("received empty content from Claude service")
	}

	// Find the first text block
	for _, block := range resp.Content {
		if block.Type == "text" && block.Text != "" {
			return block.Text, nil
		}
	}

	return "", fmt.Errorf("no text content in response")
}

// expandPromptDirect uses the Anthropic Go SDK directly
func expandPromptDirect(ctx context.Context, userMessage string) (string, error) {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create anthropic client: %w", err)
	}

	resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F([]anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage))}),
	})
	if err != nil {
		return "", fmt.Errorf("failed to call Anthropic API: %w", err)
	}

	if resp == nil {
		return "", fmt.Errorf("received nil response from Anthropic API")
	}

	if len(resp.Content) == 0 {
		return "", fmt.Errorf("received empty content from Anthropic API")
	}

	expandedPrompt := resp.Content[0].Text

	return expandedPrompt, nil
}
