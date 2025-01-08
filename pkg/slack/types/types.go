package types

import (
	"time"

	"github.com/slack-go/slack"
)

type SlackNotification interface {
	GetID() string
	GetCreatedAt() time.Time

	GetHeader() *slack.TextBlockObject
	GetTextBlockObjects() []*slack.TextBlockObject
	GetMessageOptions() []slack.MsgOption
}

type SlackNotificationRaw struct {
	ID               string
	CreatedAt        time.Time
	UserID           *string
	WorkspaceID      *string
	NotificationType string
	AdditionalData   *string
}
