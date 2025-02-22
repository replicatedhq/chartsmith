package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type ConversationStatusEvent struct {
	WorkspaceID string                    `json:"workspaceId"`
	Conversion  workspacetypes.Conversion `json:"conversion"`
}

func (e ConversationStatusEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId": e.WorkspaceID,
		"eventType":   "conversion-status",
		"conversion":  e.Conversion,
	}, nil
}

func (e ConversationStatusEvent) GetChannelName() string {
	return e.WorkspaceID
}
