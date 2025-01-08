package slack

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/slack/types"
	"github.com/slack-go/slack"
)

var (
	slackClient *slack.Client
)

func SendNotificationToSlack(e types.SlackNotification) error {
	if e == nil {
		return nil
	}

	if slackClient == nil {
		slackClient = slack.New(param.Get().SlackToken)
	}

	headerSection := slack.NewSectionBlock(e.GetHeader(), nil, nil)
	fieldsSection := slack.NewSectionBlock(nil, e.GetTextBlockObjects(), nil)

	blocks := make([]slack.Block, 0)
	blocks = append(blocks, *headerSection)
	blocks = append(blocks, *fieldsSection)

	msg := slack.NewBlockMessage(blocks...)

	_, _, err := slackClient.PostMessage(param.Get().SlackChannel, slack.MsgOptionBlocks(msg.Msg.Blocks.BlockSet...))
	if err != nil {
		return fmt.Errorf("failed to send slack message: %w", err)
	}

	return nil
}

func GetSlackNotification(ctx context.Context, id string) (types.SlackNotification, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		slack_notification.id,
		slack_notification.created_at,
		slack_notification.user_id,
		slack_notification.workspace_id,
		slack_notification.notification_type,
		slack_notification.additional_data
	FROM
		slack_notification
	WHERE
		slack_notification.id = $1`

	row := conn.QueryRow(ctx, query, id)
	raw := types.SlackNotificationRaw{}
	var userID, workspaceID sql.NullString
	var additionalData sql.NullString
	err := row.Scan(
		&raw.ID,
		&raw.CreatedAt,
		&userID,
		&workspaceID,
		&raw.NotificationType,
		&additionalData,
	)
	if err != nil {
		return nil, fmt.Errorf("error scanning slack notification: %w", err)
	}

	if userID.Valid {
		raw.UserID = &userID.String
	}
	if workspaceID.Valid {
		raw.WorkspaceID = &workspaceID.String
	}
	if additionalData.Valid {
		raw.AdditionalData = &additionalData.String
	}

	switch raw.NotificationType {
	case "new_workspace":
		e := types.WorkspaceCreated{}
		if err := e.FromData(raw); err != nil {
			return nil, fmt.Errorf("error parsing workspace created slack notification: %w", err)
		}
		return &e, nil
	default:
		return nil, fmt.Errorf("unknown slack notification type: %s", raw.NotificationType)
	}
}
