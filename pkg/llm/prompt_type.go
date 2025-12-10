package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

// ClassifyPromptType classifies a user message as either "plan" or "chat".
// It uses Anthropic's Claude model to determine if the user is asking for
// a change to the plan/chart or just asking a conversational question.
func ClassifyPromptType(ctx context.Context, message string) (string, error) {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create anthropic client: %w", err)
	}

	systemPrompt := `You are ChartSmith, an expert at creating Helm charts for Kubernetes.
You are invited to participate in an existing conversation between a user and an expert.
The expert just provided a recommendation on how to plan the Helm chart to the user.
The user is about to ask a question.
You should decide if the user is asking for a change to the plan/chart, or if they are just asking a conversational question.
Be exceptionally brief and precise in your response.
Only say "plan" or "chat" in your response.`

	msg, err := client.Messages.Create(ctx, &anthropic.MessageCreateParams{
		Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
		MaxTokens: anthropic.F(1024),
		System:    []anthropic.SystemBlockParam{anthropic.NewSystemTextBlock(systemPrompt)},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(message)),
		},
	})

	if err != nil {
		logger.Error("Failed to classify prompt type", zap.Error(err), zap.String("message", message))
		return "", fmt.Errorf("failed to classify prompt type: %w", err)
	}

	// Extract text from response
	text := ""
	if len(msg.Content) > 0 {
		if textBlock, ok := msg.Content[0].(anthropic.TextBlock); ok {
			text = textBlock.Text
		}
	}

	if text == "" {
		logger.Warn("Empty response from LLM for prompt type classification", zap.String("message", message))
		return "chat", nil // Default to chat if empty response
	}

	// Check if response contains "plan" (case-insensitive)
	if strings.Contains(strings.ToLower(text), "plan") {
		logger.Debug("Classified prompt type as plan", zap.String("message", message), zap.String("response", text))
		return "plan", nil
	}

	logger.Debug("Classified prompt type as chat", zap.String("message", message), zap.String("response", text))
	return "chat", nil
}
