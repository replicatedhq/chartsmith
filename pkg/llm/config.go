package llm

import (
	"os"

	anthropic "github.com/anthropics/anthropic-sdk-go"
)

// Model constants for Anthropic Claude models
// These constants provide a centralized location for model configuration,
// making it easier to update models across the codebase during the AI SDK migration.
const (
	// DefaultModel is the primary model used for most LLM operations
	// Currently using Claude 3.7 Sonnet (released Feb 2025)
	DefaultModel = anthropic.ModelClaude3_7Sonnet20250219

	// LegacyModel is the previous generation model (Claude 3.5 Sonnet)
	// Kept for backward compatibility if needed
	LegacyModel = anthropic.ModelClaude3_5Sonnet20241022

	// DefaultMaxTokens is the default maximum number of tokens for responses
	DefaultMaxTokens = 8192
)

// Config holds configuration for the LLM client
// This struct centralizes LLM configuration to make the codebase more maintainable
// during the migration from anthropic-sdk-go to a cleaner pattern.
type Config struct {
	// APIKey is the Anthropic API key
	APIKey string

	// Model is the Claude model to use for requests
	Model anthropic.Model

	// MaxTokens is the maximum number of tokens to generate
	MaxTokens int64
}

// NewConfig creates a new Config with default values
// The API key is retrieved from the provided parameter.
// Model defaults to DefaultModel and MaxTokens to DefaultMaxTokens.
func NewConfig(apiKey string) *Config {
	return &Config{
		APIKey:    apiKey,
		Model:     DefaultModel,
		MaxTokens: DefaultMaxTokens,
	}
}

// GetModelFromEnv retrieves the model name from an environment variable
// If the environment variable is not set, it returns the DefaultModel.
// This allows for easy model switching in different environments without code changes.
func GetModelFromEnv(envVar string) anthropic.Model {
	if modelStr := os.Getenv(envVar); modelStr != "" {
		return anthropic.Model(modelStr)
	}
	return DefaultModel
}

// WithModel sets the model for the config (fluent interface)
func (c *Config) WithModel(model anthropic.Model) *Config {
	c.Model = model
	return c
}

// WithMaxTokens sets the max tokens for the config (fluent interface)
func (c *Config) WithMaxTokens(maxTokens int64) *Config {
	c.MaxTokens = maxTokens
	return c
}
