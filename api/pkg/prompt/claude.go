package prompt

import (
	"context"
	"fmt"
	"os"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

func CreateHelmChart(ctx context.Context, prompt string) (map[string]string, error) {
	anthropicKey, ok := os.LookupEnv("ANTHROPIC_API_KEY")
	if !ok {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}
	client := anthropic.NewClient(
		option.WithAPIKey(anthropicKey),
	)
	message, err := client.Messages.New(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(1024)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
			anthropic.NewUserMessage(anthropic.NewTextBlock("generate a helm chart based on the following prompt: " + prompt)),
		}),
	})
	if err != nil {
		return nil, err
	}

	files := map[string]string{}
	for _, contentBlock := range message.Content {
		blockFiles := parseFileContents(contentBlock.Text)

		for path, content := range blockFiles {
			files[path] = content
		}
	}

	return files, nil
}

func parseFileContents(input string) map[string]string {
	files := make(map[string]string)

	// Split the input on helmsmithAction tags
	parts := strings.Split(input, "<helmsmithAction")

	// Skip the first part as it's before any helmsmithAction tag
	for _, part := range parts[1:] {
		// Only process file type actions
		if !strings.Contains(part, `type="file"`) {
			continue
		}

		// Extract the path
		pathStart := strings.Index(part, `path="`) + 6
		if pathStart < 6 {
			continue
		}
		pathEnd := strings.Index(part[pathStart:], `"`) + pathStart
		if pathEnd < pathStart {
			continue
		}
		path := part[pathStart:pathEnd]

		// Extract the content
		contentStart := strings.Index(part, ">") + 1
		if contentStart < 1 {
			continue
		}
		contentEnd := strings.Index(part, "</helmsmithAction>")
		if contentEnd < 0 {
			continue
		}
		content := part[contentStart:contentEnd]

		// Store in map
		files[path] = content
	}

	return files
}
