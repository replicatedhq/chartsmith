package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type RenderUpdatedEvent struct {
	WorkspaceID       string                      `json:"workspaceId"`
	RenderWorkspaceID string                      `json:"renderWorkspaceId"`
	RenderChartID     string                      `json:"renderChartId"`
	RenderedFile      workspacetypes.RenderedFile `json:"renderedFile"`
}

func (e RenderUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":       e.WorkspaceID,
		"eventType":         "render-updated",
		"renderWorkspaceId": e.RenderWorkspaceID,
		"renderChartId":     e.RenderChartID,
		"renderedFile":      e.RenderedFile,
	}, nil
}

func (e RenderUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}
