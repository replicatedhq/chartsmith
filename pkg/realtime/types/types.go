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
