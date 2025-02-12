package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type RenderUpdatedEvent struct {
	WorkspaceID  string                      `json:"workspaceId"`
	RenderedFile workspacetypes.RenderedFile `json:"renderedFile"`
}

func (e RenderUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":  e.WorkspaceID,
		"eventType":    "render-updated",
		"renderedFile": e.RenderedFile,
	}, nil
}

func (e RenderUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}
