package llm

import (
	"context"
	"fmt"
	"io"
	"log"

	openai "github.com/sashabaranov/go-openai"
	"github.com/replicatedhq/chartsmith/pkg/param"
)

// OpenRouterClient wraps the OpenAI client for OpenRouter
type OpenRouterClient struct {
	client *openai.Client
}

// newOpenRouterClient creates a client for OpenRouter using OpenAI-compatible API
func newOpenRouterClient(ctx context.Context) (*OpenRouterClient, error) {
	params := param.Get()
	
	if params.OpenRouterAPIKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY environment variable not set")
	}

	log.Printf("[OpenRouter Client] Creating OpenRouter client")
	
	config := openai.DefaultConfig(params.OpenRouterAPIKey)
	config.BaseURL = "https://openrouter.ai/api/v1"
	
	client := openai.NewClientWithConfig(config)
	
	return &OpenRouterClient{
		client: client,
	}, nil
}

// StreamChatCompletion streams a chat completion from OpenRouter
// This runs asynchronously and sends results to channels
func (c *OpenRouterClient) StreamChatCompletion(ctx context.Context, messages []openai.ChatCompletionMessage, streamCh chan string, doneCh chan error) {
	go func() {
		req := openai.ChatCompletionRequest{
			Model:     "anthropic/claude-3.5-sonnet",
			Messages:  messages,
			Stream:    true,
			MaxTokens: 8192,
		}

		stream, err := c.client.CreateChatCompletionStream(ctx, req)
		if err != nil {
			doneCh <- fmt.Errorf("failed to create chat completion stream: %w", err)
			return
		}
		defer stream.Close()

		for {
			response, err := stream.Recv()
			if err == io.EOF {
				doneCh <- nil
				return
			}
			if err != nil {
				doneCh <- fmt.Errorf("stream error: %w", err)
				return
			}

			if len(response.Choices) > 0 {
				content := response.Choices[0].Delta.Content
				if content != "" {
					streamCh <- content
				}
			}
		}
	}()
}

// ChatCompletion makes a non-streaming chat completion request
func (c *OpenRouterClient) ChatCompletion(ctx context.Context, messages []openai.ChatCompletionMessage) (string, error) {
	req := openai.ChatCompletionRequest{
		Model:     "anthropic/claude-3.5-sonnet",
		Messages:  messages,
		MaxTokens: 8192,
	}

	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to create chat completion: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no choices returned from OpenRouter")
	}

	return resp.Choices[0].Message.Content, nil
}

// ChatCompletionWithTools makes a chat completion request with tool/function calling support
func (c *OpenRouterClient) ChatCompletionWithTools(ctx context.Context, messages []openai.ChatCompletionMessage, tools []openai.Tool) (openai.ChatCompletionResponse, error) {
	req := openai.ChatCompletionRequest{
		Model:     "anthropic/claude-3.5-sonnet",
		Messages:  messages,
		Tools:     tools,
		MaxTokens: 8192,
	}

	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return openai.ChatCompletionResponse{}, fmt.Errorf("failed to create chat completion with tools: %w", err)
	}

	return resp, nil
}

