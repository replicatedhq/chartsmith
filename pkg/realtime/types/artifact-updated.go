package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

var _ Event = ArtifactUpdatedEvent{}

type ArtifactUpdatedEvent struct {
	WorkspaceID   string               `json:"workspaceId"`
	WorkspaceFile *workspacetypes.File `json:"file"`
}

func (e ArtifactUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"eventType":   "artifact-updated",
		"workspaceId": e.WorkspaceID,
		"file":        e.WorkspaceFile,
	}, nil
}

func (e ArtifactUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}
