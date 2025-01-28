package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

var _ Event = ChatMessageUpdatedEvent{}

type ChatMessageUpdatedEvent struct {
	WorkspaceID string               `json:"workspaceId"`
	ChatMessage *workspacetypes.Chat `json:"chatMessage"`
}

func (e ChatMessageUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId": e.WorkspaceID,
		"chatMessage": e.ChatMessage,
	}, nil
}

func (e ChatMessageUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}
