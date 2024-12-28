package types

import (
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type Config struct {
	Address string
	APIKey  string
}

type Recipient struct {
	UserIDs []string
}

func (r Recipient) GetUserIDs() []string {
	return r.UserIDs
}

type Event interface {
	GetMessageData() (map[string]interface{}, error)
	GetChannelName() string
}

var _ Event = ChatMessageUpdatedEvent{}

type ChatMessageUpdatedEvent struct {
	WorkspaceID string          `json:"workspace_id"`
	Message     *chattypes.Chat `json:"message"`
	IsComplete  bool            `json:"is_complete"`
}

func (e ChatMessageUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspace_id": e.WorkspaceID,
		"message":      e.Message,
		"is_complete":  e.IsComplete,
	}, nil
}

func (e ChatMessageUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}

var _ Event = WorkspaceUpdatedEvent{}

type WorkspaceUpdatedEvent struct {
	Workspace *workspacetypes.Workspace `json:"workspace"`
}

func (e WorkspaceUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspace": e.Workspace,
	}, nil
}

func (e WorkspaceUpdatedEvent) GetChannelName() string {
	return e.Workspace.ID
}

type WorkspaceRevisionCreatedEvent struct {
	Workspace *workspacetypes.Workspace `json:"workspace"`
}

func (e WorkspaceRevisionCreatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspace": e.Workspace,
	}, nil
}

func (e WorkspaceRevisionCreatedEvent) GetChannelName() string {
	return e.Workspace.ID
}
