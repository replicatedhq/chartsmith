package llm

import (
	"strings"
	"testing"
)

func TestParseStream_VercelAIFormat(t *testing.T) {
	client := &NextJSClient{}

	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name: "basic text deltas",
			input: `0:"Hello "
0:"world"
0:"!"`,
			expected: []string{"Hello ", "world", "!"},
		},
		{
			name: "text with control messages",
			input: `0:"Here is "
0:"the plan"
e:{"finishReason":"stop"}
d:{"finishReason":"stop"}`,
			expected: []string{"Here is ", "the plan"},
		},
		{
			name: "text with empty lines (keep-alives)",
			input: `0:"Part 1"

0:"Part 2"

`,
			expected: []string{"Part 1", "Part 2"},
		},
		{
			name: "text with special characters",
			input: `0:"Hello\nWorld"
0:"Tab:\tHere"
0:"Quote: \"test\""`,
			expected: []string{"Hello\nWorld", "Tab:\tHere", "Quote: \"test\""},
		},
		{
			name: "text with XML tags (chartsmithActionPlan)",
			input: `0:"<chartsmithActionPlan>\n"
0:"path: /templates/deployment.yaml\n"
0:"</chartsmithActionPlan>"`,
			expected: []string{"<chartsmithActionPlan>\n", "path: /templates/deployment.yaml\n", "</chartsmithActionPlan>"},
		},
		{
			name: "SSE format fallback",
			input: `data: {"type":"text","text":"Hello"}
data: {"type":"text","text":" World"}
data: [DONE]`,
			expected: []string{"Hello", " World"},
		},
		{
			name: "empty stream",
			input: ``,
			expected: []string{},
		},
		{
			name: "only control messages",
			input: `e:{"finishReason":"stop"}
d:{"finishReason":"stop"}`,
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			textCh := make(chan string, 100)
			errCh := make(chan error, 1)

			reader := strings.NewReader(tt.input)
			client.parseStream(reader, textCh, errCh)

			// Collect results
			var results []string
			close(textCh)
			for text := range textCh {
				results = append(results, text)
			}

			// Check for errors
			select {
			case err := <-errCh:
				t.Errorf("unexpected error: %v", err)
			default:
			}

			// Compare results
			if len(results) != len(tt.expected) {
				t.Errorf("got %d results, want %d", len(results), len(tt.expected))
				t.Errorf("got: %v", results)
				t.Errorf("want: %v", tt.expected)
				return
			}

			for i, result := range results {
				if result != tt.expected[i] {
					t.Errorf("result[%d] = %q, want %q", i, result, tt.expected[i])
				}
			}
		})
	}
}

func TestParseStream_ConcatenatedOutput(t *testing.T) {
	// This test verifies that the parser produces output that can be
	// concatenated to form the expected full response
	client := &NextJSClient{}

	input := `0:"# Plan\n\n"
0:"1. Create deployment\n"
0:"2. Add service\n"
0:"\n"
0:"<chartsmithActionPlan>\n"
0:"path: templates/deployment.yaml\n"
0:"type: template\n"
0:"action: create\n"
0:"</chartsmithActionPlan>\n"
e:{"finishReason":"stop"}`

	expected := `# Plan

1. Create deployment
2. Add service

<chartsmithActionPlan>
path: templates/deployment.yaml
type: template
action: create
</chartsmithActionPlan>
`

	textCh := make(chan string, 100)
	errCh := make(chan error, 1)

	reader := strings.NewReader(input)
	client.parseStream(reader, textCh, errCh)

	// Collect and concatenate results
	close(textCh)
	var result strings.Builder
	for text := range textCh {
		result.WriteString(text)
	}

	// Check for errors
	select {
	case err := <-errCh:
		t.Errorf("unexpected error: %v", err)
	default:
	}

	if result.String() != expected {
		t.Errorf("concatenated result mismatch:\ngot:\n%s\n\nwant:\n%s", result.String(), expected)
	}
}

