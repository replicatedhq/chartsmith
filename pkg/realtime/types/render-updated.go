package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type RenderUpdatedEvent struct {
	WorkspaceID   string                       `json:"workspaceId"`
	RenderedChart workspacetypes.RenderedChart `json:"renderedChart"`
}

func (e RenderUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":   e.WorkspaceID,
		"eventType":     "render-updated",
		"renderedChart": e.RenderedChart,
	}, nil
}

func (e RenderUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}
