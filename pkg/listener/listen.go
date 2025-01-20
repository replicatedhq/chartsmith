package listener

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

func Listen(ctx context.Context) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	channels := []string{"new_chat", "new_file", "new_revision", "new_slack_notification"}
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
		case "new_file":
			go func() {
				if err := handleNewFileNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new GVK notification: %+v\n", err)
				}
			}()
		case "new_chat":
			go func() {
				if err := handleNewChatNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new chat notification: %+v\n", err)
				}
			}()
		case "new_revision":
			go func() {
				if err := handleNewRevisionNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new revision notification: %+v\n", err)
				}
			}()
		// case "new_slack_notification":
		// 	go func() {
		// 		if err := handleNewSlackNotification(ctx, notification.Payload); err != nil {
		// 			fmt.Printf("Error handling new slack notification: %+v\n", err)
		// 		}
		// 	}()
		default:
			fmt.Printf("Unknown notification received: %+v\n", notification)
		}
	}
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
