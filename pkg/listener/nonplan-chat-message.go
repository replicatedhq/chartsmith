package listener

import (
	"context"
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

func handleNewNonPlanChatMessageNotification(ctx context.Context, chatMessageId string) error {
	logger.Info("Handling new non-plan chat message notification", zap.String("chatMessageId", chatMessageId))

	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var processingErr error
	defer func() {
		var errorMsg *string
		if processingErr != nil {
			errStr := processingErr.Error()
			errorMsg = &errStr
		}

		_, updateErr := conn.Exec(ctx, `
            UPDATE notification_processing
            SET processed_at = NOW(),
                error = $1
            WHERE notification_channel = $2 and notification_id = $3
        `, errorMsg, "new_nonplan_chat_message", chatMessageId)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new non-plan chat message notification: %s\n", chatMessageId)

	chatMessage, err := workspace.GetChatMessage(ctx, chatMessageId)
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
		if err := llm.CreateNonPlanChatMessage(ctx, streamCh, doneCh, w, chatMessage); err != nil {
			fmt.Printf("Failed to create non-plan chat message: %v\n", err)
			processingErr = fmt.Errorf("error creating non-plan chat message: %w", err)
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
		}
	}

	return nil
}
