package listener

import (
        "context"
        "fmt"

        "github.com/replicatedhq/chartsmith/pkg/persistence"
        "github.com/replicatedhq/chartsmith/pkg/slack"
)

func handleNewSlackNotification(ctx context.Context, id string) error {
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
        `, errorMsg, "new_slack_notification", id)

                if updateErr != nil {
                        fmt.Printf("Failed to update notification status: %v\n", updateErr)
                }
        }()

        slackNotification, err := slack.GetSlackNotification(ctx, id)
        if err != nil {
                processingErr = fmt.Errorf("failed to get Slack notification: %w", err)
                return processingErr
        }

        if err := slack.SendNotificationToSlack(slackNotification); err != nil {
                processingErr = fmt.Errorf("failed to send notification to Slack: %w", err)
                return processingErr
        }

        return nil
}
