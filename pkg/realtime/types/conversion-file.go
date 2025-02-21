package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type ConversionFileStatusEvent struct {
	WorkspaceID    string                         `json:"workspaceId"`
	ConversionID   string                         `json:"conversionId"`
	ConversionFile *workspacetypes.ConversionFile `json:"conversionFile"`
}

func (e ConversionFileStatusEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":    e.WorkspaceID,
		"eventType":      "conversion-file",
		"conversionId":   e.ConversionID,
		"conversionFile": e.ConversionFile,
	}, nil
}

func (e ConversionFileStatusEvent) GetChannelName() string {
	return e.WorkspaceID
}
