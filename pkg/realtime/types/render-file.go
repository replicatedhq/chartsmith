package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type RenderFileEvent struct {
	WorkspaceID       string                      `json:"workspaceId"`
	RenderWorkspaceID string                      `json:"renderWorkspaceId"`
	RenderChartID     string                      `json:"renderChartId"`
	RenderedFile      workspacetypes.RenderedFile `json:"renderedFile"`
}

func (e RenderFileEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":       e.WorkspaceID,
		"eventType":         "render-file",
		"renderWorkspaceId": e.RenderWorkspaceID,
		"renderChartId":     e.RenderChartID,
		"renderedFile":      e.RenderedFile,
	}, nil
}

func (e RenderFileEvent) GetChannelName() string {
	return e.WorkspaceID
}
