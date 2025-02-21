package types

type ConversationStatusEvent struct {
	WorkspaceID  string `json:"workspaceId"`
	ConversionID string `json:"conversionId"`
	Status       string `json:"status"`
}

func (e ConversationStatusEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":  e.WorkspaceID,
		"eventType":    "conversation-status",
		"conversionId": e.ConversionID,
		"status":       e.Status,
	}, nil
}

func (e ConversationStatusEvent) GetChannelName() string {
	return e.WorkspaceID
}
