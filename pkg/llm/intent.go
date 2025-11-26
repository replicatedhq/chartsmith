package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

func GetChatMessageIntent(ctx context.Context, prompt string, isInitialPrompt bool, messageFromPersona *workspacetypes.ChatMessageFromPersona) (*workspacetypes.Intent, error) {
	logger.Debug("GetChatMessageIntent",
		zap.String("prompt", prompt),
		zap.Bool("isInitialPrompt", isInitialPrompt))

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create anthropic client: %w", err)
	}

	// Build the user message based on persona
	userMessage := ""

	if messageFromPersona == nil || *messageFromPersona == workspacetypes.ChatMessageFromPersonaAuto {
		userMessage = fmt.Sprintf(`%s

		Given this, my request is:

		%s

		Determine if the prompt is a question, a request for information, or a request to perform an action.

		You will respond with a JSON object containing the following fields:
		- isConversational: true if the prompt is a question or request for information, false otherwise
		- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
		- isOffTopic: true if the prompt is off topic, false otherwise
		- isChartDeveloper: true if the question is related to planning a change to the chart, false otherwise
		- isChartOperator: true if the question is about how to use the Helm chart in a Kubernetes cluster, false otherwise
		- isProceed: true if the prompt is a clear request to execute previous instructions with no requsted changes, false otherwise
		- isRender: true if the prompt is a request to render or test or validate the chart, false otherwise

		Important: Do not respond with anything other than the JSON object.`,
			commonSystemPrompt, prompt)

	} else if *messageFromPersona == workspacetypes.ChatMessageFromPersonaDeveloper {
		userMessage = fmt.Sprintf(`%s

		Given this, my request is:

		%s

		Determine if the prompt is a question, a request for information, or a request to perform an action.

		You will respond with a JSON object containing the following fields:
		- isConversational: true if the prompt is a question or request for information, false otherwise
		- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
		- isOffTopic: true if the prompt is off topic, false otherwise
		- isChartDeveloper: true if it's possible to answer this question as if it was asked by the chat developer, false if otherwise
		- isProceed: true if the prompt is a clear request to execute previous instructions with no requsted changes, false otherwise
		- isRender: true if the prompt is a request to render or test or validate the chart, false otherwise

		Important: Do not respond with anything other than the JSON object.`,
			commonSystemPrompt, prompt)

	} else if *messageFromPersona == workspacetypes.ChatMessageFromPersonaOperator {
		userMessage = fmt.Sprintf(`%s

		Given this, my request is:

		%s

		Determine if the prompt is a question, a request for information, or a request to perform an action.

		You will respond with a JSON object containing the following fields:
		- isConversational: true if the prompt is a question or request for information, false otherwise
		- isPlan: true if the prompt is a request to perform an update to the chart templates or files, false otherwise
		- isOffTopic: true if the prompt is off topic, false otherwise
		- isChartOperator: true if it's possible to answer this question as if it was asked by the chat operator and can be completed without making any changes to the chart templates or files, false if otherwise

		Important: Do not respond with anything other than the JSON object.`,
			endUserSystemPrompt, prompt)

	}

	response, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Haiku20241022),
		MaxTokens: anthropic.F(int64(1024)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage)),
		}),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get chat message intent: %w", err)
	}

	// Extract text content from response
	responseText := ""
	for _, block := range response.Content {
		if block.Type == anthropic.ContentBlockTypeText {
			responseText = block.Text
			break
		}
	}

	// Clean up the response - remove markdown code blocks if present
	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var parsedResponse map[string]interface{}
	err = json.Unmarshal([]byte(responseText), &parsedResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w (response was: %s)", err, responseText)
	}

	intent := &workspacetypes.Intent{}

	if value, ok := parsedResponse["isConversational"].(bool); ok {
		intent.IsConversational = value
	}
	if value, ok := parsedResponse["isPlan"].(bool); ok {
		intent.IsPlan = value
	}
	if value, ok := parsedResponse["isOffTopic"].(bool); ok {
		intent.IsOffTopic = value
	}
	if value, ok := parsedResponse["isChartDeveloper"].(bool); ok {
		intent.IsChartDeveloper = value
	}
	if value, ok := parsedResponse["isChartOperator"].(bool); ok {
		intent.IsChartOperator = value
	}
	if value, ok := parsedResponse["isProceed"].(bool); ok {
		intent.IsProceed = value
	}
	if value, ok := parsedResponse["isRender"].(bool); ok {
		intent.IsRender = value
	}

	// for initial prompts, we always assume it's a plan, but we still hit this because
	// it could be totally off topic
	if isInitialPrompt {
		intent.IsPlan = true
		intent.IsProceed = false
	}

	logger.Debug("GetChatMessageIntent result",
		zap.Any("intent", intent),
	)
	return intent, nil
}

func FeedbackOnNotDeveloperIntentWhenRequested(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	logger.Debug("FeedbackOnNotDeveloperIntentWhenRequested",
		zap.String("prompt", chatMessage.Prompt),
	)

	client, err := newAnthropicClient(ctx)
	if err != nil {
		doneCh <- fmt.Errorf("failed to create anthropic client: %w", err)
		return err
	}

	systemPrompt := "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. They asked you the following question and asked you to answer it as a developer. However, you are unable to answer the question as a developer. Explain to the user that the message cannot be answered as a chart developer and why."

	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Haiku20241022),
		MaxTokens: anthropic.F(int64(1024)),
		System:    anthropic.F([]anthropic.TextBlockParam{anthropic.NewTextBlock(systemPrompt)}),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)),
		}),
	})

	for stream.Next() {
		event := stream.Current()
		if delta, ok := event.Delta.(anthropic.ContentBlockDeltaEventDelta); ok {
			if delta.Text != "" {
				streamCh <- delta.Text
			}
		}
	}

	if err := stream.Err(); err != nil {
		doneCh <- fmt.Errorf("streaming error: %w", err)
		return err
	}

	doneCh <- nil
	return nil
}

func FeedbackOnNotOperatorIntentWhenRequested(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	logger.Debug("FeedbackOnNotOperatorIntentWhenRequested",
		zap.String("prompt", chatMessage.Prompt),
	)

	client, err := newAnthropicClient(ctx)
	if err != nil {
		doneCh <- fmt.Errorf("failed to create anthropic client: %w", err)
		return err
	}

	systemPrompt := "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. They asked you the following question and asked you to answer it as an operator. However, you are unable to answer the question as an operator. Explain to the user that the message cannot be answered as a chart operator / end-user and why."

	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Haiku20241022),
		MaxTokens: anthropic.F(int64(1024)),
		System:    anthropic.F([]anthropic.TextBlockParam{anthropic.NewTextBlock(systemPrompt)}),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)),
		}),
	})

	for stream.Next() {
		event := stream.Current()
		if delta, ok := event.Delta.(anthropic.ContentBlockDeltaEventDelta); ok {
			if delta.Text != "" {
				streamCh <- delta.Text
			}
		}
	}

	if err := stream.Err(); err != nil {
		doneCh <- fmt.Errorf("streaming error: %w", err)
		return err
	}

	doneCh <- nil
	return nil
}

func FeedbackOnAmbiguousIntent(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		doneCh <- fmt.Errorf("failed to create anthropic client: %w", err)
		return err
	}

	systemPrompt := "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. You are given a prompt from the user, and you are unable to figure out it's intent. Politelty ask the user to clarify their message."

	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Haiku20241022),
		MaxTokens: anthropic.F(int64(1024)),
		System:    anthropic.F([]anthropic.TextBlockParam{anthropic.NewTextBlock(systemPrompt)}),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)),
		}),
	})

	for stream.Next() {
		event := stream.Current()
		if delta, ok := event.Delta.(anthropic.ContentBlockDeltaEventDelta); ok {
			if delta.Text != "" {
				streamCh <- delta.Text
			}
		}
	}

	if err := stream.Err(); err != nil {
		doneCh <- fmt.Errorf("streaming error: %w", err)
		return err
	}

	doneCh <- nil
	return nil
}

func DeclineOffTopicChatMessage(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		doneCh <- fmt.Errorf("failed to create anthropic client: %w", err)
		return err
	}

	systemPrompt := "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. You are given a prompt from the user and you need to decline the prompt because it is off topic."

	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Haiku20241022),
		MaxTokens: anthropic.F(int64(1024)),
		System:    anthropic.F([]anthropic.TextBlockParam{anthropic.NewTextBlock(systemPrompt)}),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)),
		}),
	})

	for stream.Next() {
		event := stream.Current()
		if delta, ok := event.Delta.(anthropic.ContentBlockDeltaEventDelta); ok {
			if delta.Text != "" {
				streamCh <- delta.Text
			}
		}
	}

	if err := stream.Err(); err != nil {
		doneCh <- fmt.Errorf("streaming error: %w", err)
		return err
	}

	doneCh <- nil
	return nil
}
