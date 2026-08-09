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

	userMessage := intentPrompt(prompt, messageFromPersona)
	client, err := newLLMClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create LLM client: %w", err)
	}

	response, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(configuredModel()),
		MaxTokens: anthropic.F(int64(1024)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage)),
		}),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get chat message intent: %w", err)
	}

	content := messageText(response)
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start < 0 || end < start {
		return nil, fmt.Errorf("intent response did not contain a JSON object: %q", content)
	}

	var parsedResponse map[string]interface{}
	if err := json.Unmarshal([]byte(content[start:end+1]), &parsedResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal intent response: %w", err)
	}

	intent := &workspacetypes.Intent{}
	setIntentBool(parsedResponse, "isConversational", &intent.IsConversational)
	setIntentBool(parsedResponse, "isPlan", &intent.IsPlan)
	setIntentBool(parsedResponse, "isOffTopic", &intent.IsOffTopic)
	setIntentBool(parsedResponse, "isChartDeveloper", &intent.IsChartDeveloper)
	setIntentBool(parsedResponse, "isChartOperator", &intent.IsChartOperator)
	setIntentBool(parsedResponse, "isProceed", &intent.IsProceed)
	setIntentBool(parsedResponse, "isRender", &intent.IsRender)

	// Initial prompts always create a plan unless the separate off-topic signal rejects them.
	if isInitialPrompt {
		intent.IsPlan = true
		intent.IsProceed = false
	}

	logger.Debug("GetChatMessageIntent result", zap.Any("intent", intent))
	return intent, nil
}

func intentPrompt(prompt string, messageFromPersona *workspacetypes.ChatMessageFromPersona) string {
	criteria := `
- isConversational: true for a question or request for information
- isPlan: true for a request to update chart templates or files
- isOffTopic: true when the prompt is unrelated to Helm chart development or operation
- isChartDeveloper: true when it can be answered as a chart developer
- isChartOperator: true when it can be answered as a chart operator without changing chart files
- isProceed: true for a clear request to execute previous instructions without changes
- isRender: true for a request to render, test, or validate the chart`

	systemPrompt := commonSystemPrompt
	if messageFromPersona != nil && *messageFromPersona == workspacetypes.ChatMessageFromPersonaOperator {
		systemPrompt = endUserSystemPrompt
		criteria = `
- isConversational: true for a question or request for information
- isPlan: true for a request to update chart templates or files
- isOffTopic: true when the prompt is unrelated to operating this Helm chart
- isChartOperator: true when it can be answered as a chart operator without changing chart files`
	} else if messageFromPersona != nil && *messageFromPersona == workspacetypes.ChatMessageFromPersonaDeveloper {
		criteria = `
- isConversational: true for a question or request for information
- isPlan: true for a request to update chart templates or files
- isOffTopic: true when the prompt is unrelated to Helm chart development
- isChartDeveloper: true when it can be answered as a chart developer
- isProceed: true for a clear request to execute previous instructions without changes
- isRender: true for a request to render, test, or validate the chart`
	}

	return fmt.Sprintf(`%s

Given this request:

%s

Classify its intent. Return one JSON object containing these boolean fields:%s

Do not return markdown or any text outside the JSON object.`, systemPrompt, prompt, criteria)
}

func setIntentBool(values map[string]interface{}, key string, target *bool) {
	if value, ok := values[key].(bool); ok {
		*target = value
	}
}

func FeedbackOnNotDeveloperIntentWhenRequested(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	logger.Debug("FeedbackOnNotDeveloperIntentWhenRequested", zap.String("prompt", chatMessage.Prompt))
	return streamIntentFeedback(ctx, streamCh, doneCh, chatMessage.Prompt,
		"You are ChartSmith, an expert Helm chart developer. Explain that this message cannot be answered as a chart developer and why.")
}

func FeedbackOnNotOperatorIntentWhenRequested(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	logger.Debug("FeedbackOnNotOperatorIntentWhenRequested", zap.String("prompt", chatMessage.Prompt))
	return streamIntentFeedback(ctx, streamCh, doneCh, chatMessage.Prompt,
		"You are ChartSmith, an expert Helm chart developer. Explain that this message cannot be answered as a chart operator or end user and why.")
}

func FeedbackOnAmbiguousIntent(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	return streamIntentFeedback(ctx, streamCh, doneCh, chatMessage.Prompt,
		"You are ChartSmith, an expert Helm chart developer. Politely ask the user to clarify this ambiguous request.")
}

func DeclineOffTopicChatMessage(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	return streamIntentFeedback(ctx, streamCh, doneCh, chatMessage.Prompt,
		"You are ChartSmith, an expert Helm chart developer. Briefly decline this request because it is off topic.")
}

func streamIntentFeedback(ctx context.Context, streamCh chan string, doneCh chan error, prompt, instruction string) error {
	client, err := newLLMClient(ctx)
	if err != nil {
		return err
	}

	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(configuredModel()),
		MaxTokens: anthropic.F(int64(1024)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(instruction)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(prompt)),
		}),
	})

	for stream.Next() {
		event := stream.Current()
		if delta, ok := event.Delta.(anthropic.ContentBlockDeltaEventDelta); ok && delta.Text != "" {
			streamCh <- delta.Text
		}
	}
	if err := stream.Err(); err != nil {
		doneCh <- err
		return err
	}

	doneCh <- nil
	return nil
}
