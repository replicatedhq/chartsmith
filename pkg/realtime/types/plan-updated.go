package types

import (
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

var _ Event = PlanUpdatedEvent{}

type PlanUpdatedEvent struct {
	WorkspaceID string               `json:"workspaceId"`
	Plan        *workspacetypes.Plan `json:"plan"`
}

func (e PlanUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId": e.WorkspaceID,
		"plan":        e.Plan,
	}, nil
}

func (e PlanUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}
