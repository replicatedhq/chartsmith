package api

// AISDKMessage represents a message in AI SDK format.
type AISDKMessage struct {
	ID        string                 `json:"id"`
	Role      string                 `json:"role"` // "user", "assistant", "system"
	Content   string                 `json:"content"`
	CreatedAt string                 `json:"createdAt,omitempty"`
	ToolCalls []AISDKToolInvocation  `json:"toolInvocations,omitempty"`
}

// AISDKToolInvocation represents a tool call in AI SDK format.
type AISDKToolInvocation struct {
	ToolCallID string      `json:"toolCallId"`
	ToolName   string      `json:"toolName"`
	Args       interface{} `json:"args"`
	Result     interface{} `json:"result,omitempty"`
}

// ChatStreamRequest represents the request body for chat streaming.
type ChatStreamRequest struct {
	Messages    []AISDKMessage `json:"messages"`
	WorkspaceID string         `json:"workspaceId"`
	UserID      string         `json:"userId"`
}
