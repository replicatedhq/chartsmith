package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jpoz/groq"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

func GetChatMessageIntent(ctx context.Context, prompt string, isInitialPrompt bool, messageFromPersona *workspacetypes.ChatMessageFromPersona) (*workspacetypes.Intent, error) {
	logger.Debug("GetChatMessageIntent",
		zap.String("prompt", prompt),
		zap.Bool("isInitialPrompt", isInitialPrompt))

	client := groq.NewClient(groq.WithAPIKey(param.Get().GroqAPIKey))

	// deepseek r1 recommends no system prompt, include everything in the user prompt
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

	response, err := client.CreateChatCompletion(groq.CompletionCreateParams{
		Model: "llama-3.3-70b-versatile",
		ResponseFormat: groq.ResponseFormat{
			Type: "json_object",
		},
		Messages: []groq.Message{
			{
				Role:    "user",
				Content: userMessage,
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get chat message intent: %w", err)
	}

	var parsedResponse map[string]interface{}
	err = json.Unmarshal([]byte(response.Choices[0].Message.Content), &parsedResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
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
	client := groq.NewClient(groq.WithAPIKey(param.Get().GroqAPIKey))

	chatCompletion, err := client.CreateChatCompletion(groq.CompletionCreateParams{
		Model:  "llama-3.3-70b-versatile",
		Stream: true,
		Messages: []groq.Message{
			{
				Role:    "system",
				Content: "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. They asked you the following question and asked you to answer it as a developer. However, you are unable to answer the question as a developer. Explain to the user that the message cannot be answered as a chart developer and why.",
			},
			{
				Role:    "user",
				Content: chatMessage.Prompt,
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to get chat message intent: %w", err)
	}

	for delta := range chatCompletion.Stream {
		streamCh <- delta.Choices[0].Delta.Content
	}

	doneCh <- nil
	return nil
}

func FeedbackOnNotOperatorIntentWhenRequested(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	logger.Debug("FeedbackOnNotOperatorIntentWhenRequested",
		zap.String("prompt", chatMessage.Prompt),
	)
	client := groq.NewClient(groq.WithAPIKey(param.Get().GroqAPIKey))

	chatCompletion, err := client.CreateChatCompletion(groq.CompletionCreateParams{
		Model:  "llama-3.3-70b-versatile",
		Stream: true,
		Messages: []groq.Message{
			{
				Role:    "system",
				Content: "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. They asked you the following question and asked you to answer it as an operator. However, you are unable to answer the question as an operator. Explain to the user that the message cannot be answered as a chart operator / end-user and why.",
			},
			{
				Role:    "user",
				Content: chatMessage.Prompt,
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to get chat message intent: %w", err)
	}

	for delta := range chatCompletion.Stream {
		streamCh <- delta.Choices[0].Delta.Content
	}

	doneCh <- nil
	return nil
}

func FeedbackOnAmbiguousIntent(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	client := groq.NewClient(groq.WithAPIKey(param.Get().GroqAPIKey))

	chatCompletion, err := client.CreateChatCompletion(groq.CompletionCreateParams{
		Model:  "llama-3.3-70b-versatile",
		Stream: true,
		Messages: []groq.Message{
			{
				Role:    "system",
				Content: "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. You are given a prompt from the user, and you are unable to figure out it's intent. Politelty ask the user to clarify their message.",
			},
			{
				Role:    "user",
				Content: chatMessage.Prompt,
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to get chat message intent: %w", err)
	}

	for delta := range chatCompletion.Stream {
		streamCh <- delta.Choices[0].Delta.Content
	}

	doneCh <- nil
	return nil
}

func DeclineOffTopicChatMessage(ctx context.Context, streamCh chan string, doneCh chan error, chatMessage *workspacetypes.Chat) error {
	client := groq.NewClient(groq.WithAPIKey(param.Get().GroqAPIKey))

	chatCompletion, err := client.CreateChatCompletion(groq.CompletionCreateParams{
		Model:  "llama-3.3-70b-versatile",
		Stream: true,
		Messages: []groq.Message{
			{
				Role:    "system",
				Content: "You are Chartsmith, an expert Helm chart developer. You are currently pairing with a user who is trying to create a Helm chart. You are given a prompt from the user and you need to decline the prompt because it is off topic.",
			},
			{
				Role:    "user",
				Content: chatMessage.Prompt,
			},
		},
	})

	if err != nil {
		doneCh <- fmt.Errorf("failed to decline off-topic chat message: %w", err)
		return fmt.Errorf("failed to decline off-topic chat message: %w", err)
	}

	// anthropic and groq work differently here, and we want to limit that
	// to this llm package.
	// so we need to make sure we only send the delta to the streamCh

	for delta := range chatCompletion.Stream {
		streamCh <- delta.Choices[0].Delta.Content
	}

	doneCh <- nil
	return nil
}
