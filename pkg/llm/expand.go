package llm

import (
	"context"
	"fmt"
)

// ExpandPrompt expands a user prompt with additional context and specificity
// Now uses Vercel AI SDK via Next.js API instead of direct Anthropic SDK
func ExpandPrompt(ctx context.Context, prompt string) (string, error) {
	// Create Next.js client (replaces Anthropic SDK)
	client := NewNextJSClient()

	// Build the expansion request with the same prompt structure
	userMessage := fmt.Sprintf(`The following question is about developing a Helm chart.
There is an existing chart that we will be editing.
Look at the question, and help decide how to determine the existing files that are relevant to the question.
Try to structure the terms to be as specific as possible to avoid nearby matches.

To do this, take the prompt below, and expand it to include specific terms that we should search for in the existing chart.

If there are Kubernetes GVKs that are relevant to the question, include them prominently in the expanded prompt.

The expanded prompt should be a single paragraph, and should be no more than 100 words.

Here is the prompt:

%s
	`, prompt)

	// Call Next.js API (which uses Vercel AI SDK)
	expandedPrompt, err := client.ExpandPrompt(ctx, ExpandRequest{
		Prompt: userMessage,
	})
	if err != nil {
		return "", fmt.Errorf("failed to expand prompt via Next.js API: %w", err)
	}

	if expandedPrompt == "" {
		return "", fmt.Errorf("received empty expanded prompt from Next.js API")
	}

	// we can inject some keywords into the prompt to help the match in the vector search
	return expandedPrompt, nil
}
