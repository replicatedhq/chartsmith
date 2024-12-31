package listener

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

func Listen(ctx context.Context) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	channels := []string{"new_workspace", "new_chat", "new_gvk"}
	for _, channel := range channels {
		_, err := conn.Exec(ctx, fmt.Sprintf("LISTEN %s", channel))
		if err != nil {
			return fmt.Errorf("failed to listen on channel %s: %w", channel, err)
		}
		fmt.Printf("Listening on channel: %s\n", channel)
	}

	for {
		fmt.Printf("Waiting for notification...\n")
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			return fmt.Errorf("waiting for notification: %w", err)
		}

		// Try to claim this notification for processing
		claimed, err := claimNotification(ctx, notification.Channel, notification.Payload)
		if err != nil {
			fmt.Printf("Error claiming notification: %v\n", err)
			continue
		}

		if !claimed {
			fmt.Printf("Notification already claimed by another process\n")
			continue
		}

		switch notification.Channel {
		case "new_workspace":
			fmt.Printf("New workspace notification received: %+v\n", notification)
			go func() {
				if err := handleNewWorkspaceNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new chat notification: %+v\n", err)
				}
			}()
		case "new_gvk":
			fmt.Printf("New GVK notification received: %+v\n", notification)
			if err := handleGVKNotification(ctx, notification.Payload); err != nil {
				fmt.Printf("Error handling new GVK notification: %+v\n", err)
			}
		case "new_chat":
			fmt.Printf("New chat notification received: %+v\n", notification)
		default:
			fmt.Printf("Unknown notification received: %+v\n", notification)
		}
	}
}

func handleGVKNotification(ctx context.Context, id string) error {
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
        `, errorMsg, "new_gvk", id)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new GVK notification: %s\n", id)

	gvk, err := workspace.GetGVK(ctx, id)
	if err != nil {
		processingErr = err
		return err
	}

	summary, err := llm.SummarizeGVK(ctx, gvk.Content)
	if err != nil {
		processingErr = err
		return err
	}

	gvk.Summary = &summary

	fmt.Printf("Summary: %s\n", summary)

	return nil
}

func handleNewWorkspaceNotification(ctx context.Context, id string) error {
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
        `, errorMsg, "new_workspace", id)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new workspace notification: %s\n", id)

	w, err := workspace.GetWorkspace(ctx, id)
	if err != nil {
		processingErr = err
		return err
	}

	chatMessages, err := chat.ListChatMessagesForWorkspace(ctx, w.ID)
	if err != nil {
		fmt.Printf("Error listing chat messages for workspace %s: %v\n", w.ID, err)
		return nil
	}

	if len(chatMessages) == 0 {
		return nil
	}

	go func(chatMessage chattypes.Chat) {
		err := llm.CreateNewChartFromMessage(ctx, w, &chatMessage)
		if err != nil {
			fmt.Printf("Error sending chat message: %+v\n", err)
		}
	}(chatMessages[0])

	return nil
}

func claimNotification(ctx context.Context, notificationChannel string, notificationID string) (bool, error) {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var claimed bool
	err := conn.QueryRow(ctx, `
        INSERT INTO notification_processing (
			notification_channel,
            notification_id,
            claimed_at,
            claimed_by
        )
        VALUES ($1, $2, NOW(), pg_backend_pid())
        ON CONFLICT (notification_channel, notification_id) DO NOTHING
        RETURNING true
    `, notificationChannel, notificationID).Scan(&claimed)

	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
