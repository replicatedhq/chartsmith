package types

type ConversionFileStatusEvent struct {
	WorkspaceID  string `json:"workspaceId"`
	ConversionID string `json:"conversionId"`
	FilePath     string `json:"filePath"`
	Status       string `json:"status"`
}

func (e ConversionFileStatusEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":  e.WorkspaceID,
		"eventType":    "conversion-file",
		"conversionId": e.ConversionID,
		"filePath":     e.FilePath,
		"status":       e.Status,
	}, nil
}

func (e ConversionFileStatusEvent) GetChannelName() string {
	return e.WorkspaceID
}
