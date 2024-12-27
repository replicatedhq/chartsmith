package types

type Config struct {
	Address string
	APIKey  string
}

type Recipient struct {
	UserIDs []string
}

func (r Recipient) GetUserIDs() []string {
	return r.UserIDs
}

type Event interface {
	GetMessageData() (map[string]interface{}, error)
	GetChannelName() string
}

var _ Event = ChatMessageUpdatedEvent{}

type ChatMessageUpdatedEvent struct {
	WorkspaceID string `json:"workspace_id"`
	Message     string `json:"message"`
	IsComplete  bool   `json:"is_complete"`
}

func (e ChatMessageUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspace_id": e.WorkspaceID,
		"message":      e.Message,
		"is_complete":  e.IsComplete,
	}, nil
}

func (e ChatMessageUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}
