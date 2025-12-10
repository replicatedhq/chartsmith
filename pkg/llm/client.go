package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/replicatedhq/chartsmith/pkg/param"
)

// newAnthropicClient creates a new Anthropic API client with the configured API key.
// This function validates that the API key is set before creating the client.
//
// Note: The Go backend continues using anthropic-sdk-go. This pattern allows for
// potential migration to aisdk-go in the future while maintaining backward compatibility.
//
// Returns an error if the ANTHROPIC_API_KEY environment variable is not set.
func newAnthropicClient(ctx context.Context) (*anthropic.Client, error) {
	if param.Get().AnthropicAPIKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}
	client := anthropic.NewClient(
		option.WithAPIKey(param.Get().AnthropicAPIKey),
	)

	return client, nil
}

// NewAnthropicClientWithConfig creates a new Anthropic API client using the provided Config.
// This helper function allows for more flexible client configuration during the AI SDK migration.
//
// Example usage:
//   config := NewConfig(apiKey).WithModel(DefaultModel).WithMaxTokens(4096)
//   client, err := NewAnthropicClientWithConfig(ctx, config)
func NewAnthropicClientWithConfig(ctx context.Context, cfg *Config) (*anthropic.Client, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("API key is required")
	}
	client := anthropic.NewClient(
		option.WithAPIKey(cfg.APIKey),
	)

	return client, nil
}

// GetDefaultConfig creates a Config instance with default settings from the environment.
// This is a convenience function that retrieves the API key from param.Get() and
// uses the DefaultModel and DefaultMaxTokens constants.
func GetDefaultConfig() (*Config, error) {
	if param.Get().AnthropicAPIKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}
	return NewConfig(param.Get().AnthropicAPIKey), nil
}
