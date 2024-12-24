package types

import "time"

type Chat struct {
	ID               string
	WorkspaceID      string
	IsInitialMessage bool
	CreatedAt        time.Time
	SentBy           string
	Prompt           string
	Response         string
	IsComplete       bool
}
