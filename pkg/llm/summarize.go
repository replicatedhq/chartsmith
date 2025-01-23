package llm

import (
	"context"

	anthropic "github.com/anthropics/anthropic-sdk-go"
)

func SummarizeContent(ctx context.Context, content string) (string, error) {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", err
	}

	userMessage := "My helm chart includes the following file. Summarize it, including all names, variables, etc that it uses: " + content

	responseMessage, err := client.Messages.New(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage)),
		}),
	})

	if err != nil {
		return "", err
	}

	return responseMessage.Content[0].Text, nil
}
