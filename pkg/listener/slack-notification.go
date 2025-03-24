package listener

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/slack"
)

func handleNewSlackNotification(ctx context.Context, id string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	slackNotification, err := slack.GetSlackNotification(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get slack notification: %w", err)
	}

	if err := slack.SendNotificationToSlack(slackNotification); err != nil {
		return fmt.Errorf("failed to send notification to slack: %w", err)
	}

	return nil
}
