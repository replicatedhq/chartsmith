package llm

import (
	"os"
	"testing"
)

func TestGetModelConfig(t *testing.T) {
	// Save original env vars to restore later
	originalChartsmith := os.Getenv("CHARTSMITH_LLM_MODEL")
	originalOpenRouter := os.Getenv("OPENROUTER_API_KEY")
	originalAnthropic := os.Getenv("ANTHROPIC_API_KEY")
	originalOpenAI := os.Getenv("OPENAI_API_KEY")
	originalGoogle := os.Getenv("GOOGLE_GENERATIVE_AI_API_KEY")

	defer func() {
		// Restore original env vars
		os.Setenv("CHARTSMITH_LLM_MODEL", originalChartsmith)
		os.Setenv("OPENROUTER_API_KEY", originalOpenRouter)
		os.Setenv("ANTHROPIC_API_KEY", originalAnthropic)
		os.Setenv("OPENAI_API_KEY", originalOpenAI)
		os.Setenv("GOOGLE_GENERATIVE_AI_API_KEY", originalGoogle)
	}()

	tests := []struct {
		name           string
		chartsmithModel string
		openRouterKey  string
		anthropicKey   string
		openAIKey      string
		googleKey      string
		expectedModel  string
	}{
		{
			name:           "Manual override takes precedence",
			chartsmithModel: "custom-model",
			openRouterKey:  "sk-or-test",
			anthropicKey:   "sk-ant-test",
			expectedModel:  "custom-model",
		},
		{
			name:          "OpenRouter key detected",
			openRouterKey: "sk-or-test",
			anthropicKey:  "sk-ant-test",
			expectedModel: "anthropic/claude-3.7-sonnet",
		},
		{
			name:          "Anthropic key detected",
			anthropicKey:  "sk-ant-test",
			expectedModel: "claude-3-7-sonnet-20250219",
		},
		{
			name:          "OpenAI key detected",
			openAIKey:     "sk-proj-test",
			expectedModel: "gpt-4o",
		},
		{
			name:          "Google key detected",
			googleKey:     "test-google-key",
			expectedModel: "gemini-2.0-flash-exp",
		},
		{
			name:          "No keys - fallback to Claude 3.7",
			expectedModel: "claude-3-7-sonnet-20250219",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear all env vars
			os.Unsetenv("CHARTSMITH_LLM_MODEL")
			os.Unsetenv("OPENROUTER_API_KEY")
			os.Unsetenv("ANTHROPIC_API_KEY")
			os.Unsetenv("OPENAI_API_KEY")
			os.Unsetenv("GOOGLE_GENERATIVE_AI_API_KEY")

			// Set test env vars
			if tt.chartsmithModel != "" {
				os.Setenv("CHARTSMITH_LLM_MODEL", tt.chartsmithModel)
			}
			if tt.openRouterKey != "" {
				os.Setenv("OPENROUTER_API_KEY", tt.openRouterKey)
			}
			if tt.anthropicKey != "" {
				os.Setenv("ANTHROPIC_API_KEY", tt.anthropicKey)
			}
			if tt.openAIKey != "" {
				os.Setenv("OPENAI_API_KEY", tt.openAIKey)
			}
			if tt.googleKey != "" {
				os.Setenv("GOOGLE_GENERATIVE_AI_API_KEY", tt.googleKey)
			}

			config := GetModelConfig()
			if config.Model != tt.expectedModel {
				t.Errorf("GetModelConfig() = %v, want %v", config.Model, tt.expectedModel)
			}
		})
	}
}

