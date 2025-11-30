package llm

import (
	"context"
	"fmt"
	"log"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/replicatedhq/chartsmith/pkg/param"
)

// GetModel returns the appropriate model identifier based on the configured provider
func GetModel() anthropic.Model {
	params := param.Get()
	provider := params.AIProvider
	if provider == "" {
		provider = "openrouter"
	}

	if provider == "openrouter" {
		// OpenRouter expects model names in the format "provider/model"
		// Use Claude 3.5 Sonnet via OpenRouter
		return anthropic.Model("anthropic/claude-3.5-sonnet")
	}

	// Use Anthropic's latest Claude model
	return anthropic.ModelClaude3_7Sonnet20250219
}

// getProvider returns the configured AI provider
func getProvider() string {
	params := param.Get()
	provider := params.AIProvider
	if provider == "" {
		provider = "openrouter"
	}
	return provider
}

// newAnthropicClient creates a client for Anthropic
// Note: This should only be called when provider is explicitly "anthropic"
func newAnthropicClient(ctx context.Context) (*anthropic.Client, error) {
	params := param.Get()

	if params.AnthropicAPIKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}
	log.Printf("[LLM Client] Creating Anthropic client")
	
	client := anthropic.NewClient(
		option.WithAPIKey(params.AnthropicAPIKey),
	)

	return client, nil
}
