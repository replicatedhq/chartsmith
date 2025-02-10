package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
)

func ExpandPrompt(ctx context.Context, prompt string) (string, error) {
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
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F([]anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage))}),
	})

	expandedPrompt := resp.Content[0].Text

	// we can inject some keywords into the prompt to help the match in the vector search
	return expandedPrompt, nil
}
