package types

import (
	"fmt"
)

// AISDKMessage represents an AI SDK format message
type AISDKMessage struct {
	Role    string `json:"role"`    // "user", "assistant", "system"
	Content string `json:"content"`
}

// AISDKStreamEvent wraps AI SDK stream events
type AISDKStreamEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"-"`
}

// Event type constants for AI SDK stream protocol
const (
	EventTypeTextDelta  = "text-delta"
	EventTypeToolCall   = "tool-call"
	EventTypeToolResult = "tool-result"
	EventTypeFinish     = "finish"
)

// ConvertAnthropicMessage converts Anthropic format to AI SDK format
// Stub implementation - will be filled in PR#3
func ConvertAnthropicMessage(msg interface{}) (*AISDKMessage, error) {
	return nil, fmt.Errorf("not implemented")
}

