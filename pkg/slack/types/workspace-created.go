package types

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/slack-go/slack"
)

type WorkspaceCreated struct {
	ID string

	UserID    string
	UserName  string
	UserEmail string

	WorkspaceID string

	CreatedAt time.Time

	// additional data
	CreatedType string
	Prompt      string
}

func (e *WorkspaceCreated) FromData(raw SlackNotificationRaw) error {
	e.ID = raw.ID
	e.CreatedAt = raw.CreatedAt

	if raw.UserID != nil {
		e.UserID = *raw.UserID

		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		query := `SELECT
			chartsmith_user.name,
			chartsmith_user.email
		FROM
			chartsmith_user
		WHERE
			chartsmith_user.id = $1`

		row := conn.QueryRow(context.Background(), query, *raw.UserID)
		var userName, userEmail sql.NullString
		err := row.Scan(
			&userName,
			&userEmail,
		)
		if err != nil {
			return fmt.Errorf("error scanning user: %w", err)
		}

		if userName.Valid {
			e.UserName = userName.String
		}
		if userEmail.Valid {
			e.UserEmail = userEmail.String
		}
	}
	if raw.WorkspaceID != nil {
		e.WorkspaceID = *raw.WorkspaceID
	}

	var additionalData map[string]interface{}
	err := json.Unmarshal([]byte(*raw.AdditionalData), &additionalData)
	if err != nil {
		return fmt.Errorf("error unmarshaling additional data: %w", err)
	}

	createdType, ok := additionalData["createdType"].(string)
	if !ok {
		return fmt.Errorf("invalid createdType in additional data")
	}
	e.CreatedType = createdType

	prompt, ok := additionalData["prompt"].(string)
	if !ok {
		return fmt.Errorf("invalid prompt in additional data")
	}
	e.Prompt = prompt

	return nil
}

func (e WorkspaceCreated) GetID() string {
	return e.ID
}

func (e WorkspaceCreated) GetCreatedAt() time.Time {
	return e.CreatedAt
}

func (e WorkspaceCreated) GetHeader() *slack.TextBlockObject {
	return slack.NewTextBlockObject("mrkdwn", fmt.Sprintf("*Chartsmith Workspace Created* by %s (%s)", e.UserName, e.UserEmail), false, false)
}

func (e WorkspaceCreated) GetTextBlockObjects() []*slack.TextBlockObject {
	return []*slack.TextBlockObject{
		slack.NewTextBlockObject("mrkdwn", fmt.Sprintf("*Initial Prompt:* %s", e.Prompt), false, false),
	}
}

func (e WorkspaceCreated) GetMessageOptions() []slack.MsgOption {
	return []slack.MsgOption{
		slack.MsgOptionText(e.WorkspaceID, false),
	}
}

var _ SlackNotification = (*WorkspaceCreated)(nil)
