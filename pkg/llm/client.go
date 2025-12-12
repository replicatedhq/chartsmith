package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/replicatedhq/chartsmith/pkg/param"
)

func newAnthropicClient(ctx context.Context) (*anthropic.Client, error) {
	if param.Get().AnthropicAPIKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}
	client := anthropic.NewClient(
		option.WithAPIKey(param.Get().AnthropicAPIKey),
	)

	return &client, nil
}
