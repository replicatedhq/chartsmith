package llm

import "os"

// ModelConfig holds LLM model configuration
type ModelConfig struct {
	Model string // Automatically selected based on available API keys
}

// GetModelConfig returns the current model configuration
// Automatically selects the best model based on available API keys
// Optional override via CHARTSMITH_LLM_MODEL env var (for advanced users)
func GetModelConfig() ModelConfig {
	// Allow manual override for advanced users
	if model := os.Getenv("CHARTSMITH_LLM_MODEL"); model != "" {
		return ModelConfig{Model: model}
	}

	// Auto-detect based on available API keys
	// Priority: OpenRouter > Anthropic > OpenAI > Google
	if os.Getenv("OPENROUTER_API_KEY") != "" {
		return ModelConfig{Model: "anthropic/claude-3.7-sonnet"}
	}
	if os.Getenv("ANTHROPIC_API_KEY") != "" {
		return ModelConfig{Model: "claude-3-7-sonnet-20250219"}
	}
	if os.Getenv("OPENAI_API_KEY") != "" {
		return ModelConfig{Model: "gpt-4o"}
	}
	if os.Getenv("GOOGLE_GENERATIVE_AI_API_KEY") != "" {
		return ModelConfig{Model: "gemini-2.0-flash-exp"}
	}

	// Fallback (will error when trying to use, but clear message)
	return ModelConfig{Model: "claude-3-7-sonnet-20250219"}
}

// Legacy constants for backward compatibility during migration
const (
	TextEditor_Sonnet37 = "text_editor_20250124"
	TextEditor_Sonnet35 = "text_editor_20241022"
	Model_Sonnet37      = "claude-3-7-sonnet-20250219"
	Model_Sonnet35      = "claude-3-5-sonnet-20241022"
)

