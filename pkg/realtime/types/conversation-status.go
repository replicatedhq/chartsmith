package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type ConversionStatusEvent struct {
	WorkspaceID string                    `json:"workspaceId"`
	Conversion  workspacetypes.Conversion `json:"conversion"`
}

func (e ConversionStatusEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId": e.WorkspaceID,
		"eventType":   "conversion-status",
		"conversion":  e.Conversion,
	}, nil
}

func (e ConversionStatusEvent) GetChannelName() string {
	return e.WorkspaceID
}
