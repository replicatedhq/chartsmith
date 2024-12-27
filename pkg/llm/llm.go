package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/chat"
	"github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

func SendChatMessage(ctx context.Context, c *types.Chat) error {
	fmt.Printf("Sending chat message: %+v\n", c)
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	userMessage := c.Prompt
	if c.IsInitialMessage {
		userMessage = "generate a helm chart based on the following prompt: " + c.Prompt
	}

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(1024)),
		Messages: anthropic.F([]anthropic.MessageParam{
			anthropic.NewAssistantMessage(anthropic.NewTextBlock(systemPrompt)),
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage)),
		}),
	})

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, c.WorkspaceID)
	if err != nil {
		return err
	}

	fmt.Printf("Streaming response to user ids: %+v\n", userIDs)

	// we know we will have a message
	responseChatMessage, err := chat.CreateResponseMessage(ctx, c.WorkspaceID)
	if err != nil {
		return err
	}

	// minimize database writes by keeping this message in memory while it's streaming back, only writing
	// to the database when complete.  but still send the message as we receive it over the realtime socket
	// to the client

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				responseChatMessage.Prompt += delta.Text

				e := realtimetypes.ChatMessageUpdatedEvent{
					WorkspaceID: c.WorkspaceID,
					Message:     responseChatMessage.Prompt,
					IsComplete:  false,
				}
				r := realtimetypes.Recipient{
					UserIDs: userIDs,
				}

				if err := realtime.SendEvent(ctx, r, e); err != nil {
					return err
				}
			}
		}
	}

	if stream.Err() != nil {
		return stream.Err()
	}

	return nil
}
