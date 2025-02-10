package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type RevisionCreatedEvent struct {
	WorkspaceID string                   `json:"workspaceId"`
	Workspace   workspacetypes.Workspace `json:"workspace"`
	Revision    workspacetypes.Revision  `json:"revision"`
}

func (e RevisionCreatedEvent) GetChannelName() string {
	return e.Workspace.ID
}

func (e RevisionCreatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspace": e.Workspace,
		"eventType": "revision-created",
		"revision":  e.Revision,
	}, nil
}
