package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type RenderFileEvent struct {
	WorkspaceID   string                      `json:"workspaceId"`
	RenderID      string                      `json:"renderId"`
	RenderChartID string                      `json:"renderChartId"`
	RenderedFile  workspacetypes.RenderedFile `json:"renderedFile"`
}

func (e RenderFileEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":   e.WorkspaceID,
		"eventType":     "render-file",
		"renderId":      e.RenderID,
		"renderChartId": e.RenderChartID,
		"renderedFile":  e.RenderedFile,
	}, nil
}

func (e RenderFileEvent) GetChannelName() string {
	return e.WorkspaceID
}
