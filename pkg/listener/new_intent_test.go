package listener

import "testing"

func TestRemoveThinkingContent(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no think tags",
			input:    "hello world",
			expected: "hello world",
		},
		{
			name:     "complete think section",
			input:    "before<think>thinking about stuff</think>after",
			expected: "beforeafter",
		},
		{
			name:     "only opening tag",
			input:    "before<think>thinking",
			expected: "",
		},
		{
			name:     "only closing tag",
			input:    "thinking</think>after",
			expected: "after",
		},
		{
			name:     "think at start",
			input:    "<think>thinking</think>after",
			expected: "after",
		},
		{
			name:     "think at end",
			input:    "before<think>thinking</think>",
			expected: "before",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := removeThinkingContent(tt.input)
			if result != tt.expected {
				t.Errorf("removeThinkingContent() = %v, want %v", result, tt.expected)
			}
		})
	}
}
