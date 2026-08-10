package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/replicatedhq/chartsmith/pkg/param"
)

const fireworksAnthropicBaseURL = "https://api.fireworks.ai/inference"

func newLLMClient(ctx context.Context) (*anthropic.Client, error) {
	p := param.Get()
	if p.LLMProvider != "anthropic" && p.LLMProvider != "fireworks" {
		return nil, fmt.Errorf("unsupported LLM_PROVIDER %q (must be anthropic or fireworks)", p.LLMProvider)
	}
	if p.LLMAPIKey() == "" {
		return nil, fmt.Errorf("%s environment variable not set", p.LLMAPIKeyEnvName())
	}

	options := []option.RequestOption{option.WithAPIKey(p.LLMAPIKey())}
	if p.LLMProvider == "fireworks" {
		options = append(options, option.WithBaseURL(fireworksAnthropicBaseURL))
	}
	client := anthropic.NewClient(options...)

	return client, nil
}

func configuredModel() anthropic.Model {
	return anthropic.Model(param.Get().LLMModel)
}

func messageText(message *anthropic.Message) string {
	if message == nil {
		return ""
	}
	parts := make([]string, 0, len(message.Content))
	for _, block := range message.Content {
		if block.Text != "" {
			parts = append(parts, block.Text)
		}
	}
	return strings.Join(parts, "")
}
