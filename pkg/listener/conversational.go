package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

type newConverationalPayload struct {
	ChatMessageID string `json:"chatMessageId"`
}

func handleConverationalNotification(ctx context.Context, payload string) error {
	logger.Info("Handling new conversational chat message notification",
		zap.String("payload", payload))

	var p newConverationalPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	chatMessage, err := workspace.GetChatMessage(ctx, p.ChatMessageID)
	if err != nil {
		return fmt.Errorf("error getting chat message: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, chatMessage.WorkspaceID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	streamCh := make(chan string, 1)
	doneCh := make(chan error, 1)
	go func() {
		if err := llm.ConversationalChatMessage(ctx, streamCh, doneCh, w, chatMessage); err != nil {
			logger.Errorf("Failed to create conversational chat message: %v", err)
			doneCh <- fmt.Errorf("error creating conversational chat message: %w", err)
		}
	}()

	var buffer strings.Builder
	done := false
	for !done {
		select {
		case stream := <-streamCh:
			// Trust the stream's spacing and just append
			buffer.WriteString(stream)

			// Send realtime update with current state
			chatMessage.Response = buffer.String()
			e := realtimetypes.ChatMessageUpdatedEvent{
				WorkspaceID: w.ID,
				ChatMessage: chatMessage,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send chat message update: %w", err)
			}

			// Write to database
			if err := workspace.AppendChatMessageResponse(ctx, chatMessage.ID, stream); err != nil {
				return fmt.Errorf("failed to write chat message response to database: %w", err)
			}
		case err := <-doneCh:
			if err != nil {
				return fmt.Errorf("error creating initial plan: %w", err)
			}
			done = true

			// The message is complete, update the database to mark it as complete
			if err := workspace.SetChatMessageIntent(ctx, chatMessage.ID, true, true, false, false, false); err != nil {
				return fmt.Errorf("failed to set chat message intent: %w", err)
			}

			// Create a render job and associate it with this chat message
			if err := workspace.EnqueueRenderWorkspaceForRevision(ctx, w.ID, w.CurrentRevision, chatMessage.ID); err != nil {
				return fmt.Errorf("failed to create render job for non-plan chat message: %w", err)
			}
		}
	}

	return nil
}
