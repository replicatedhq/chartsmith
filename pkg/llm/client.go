package llm

import (
	"context"
	"fmt"
	"os"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

func newAnthropicClient(ctx context.Context) (*anthropic.Client, error) {
	anthropicKey, ok := os.LookupEnv("ANTHROPIC_API_KEY")
	if !ok {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}
	client := anthropic.NewClient(
		option.WithAPIKey(anthropicKey),
	)

	return client, nil
}
