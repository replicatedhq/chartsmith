package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
)

// StreamAnthropicToAISDK converts Anthropic streaming events to AI SDK format.
// This is the main integration point between Anthropic SDK and AI SDK protocol.
// The stream parameter should be the result of client.Messages.NewStreaming().
//
// This implementation handles:
// - Text streaming via ContentBlockDeltaEvent with TextDelta
// - Tool call detection via ContentBlockStartEvent with ToolUseBlock
// - Tool argument streaming via ContentBlockDeltaEvent with InputJSONDelta
// - Stop reason extraction via MessageDeltaEvent
func StreamAnthropicToAISDK(
	ctx context.Context,
	stream interface {
		Next() bool
		Current() interface{ AsUnion() interface{} }
		Err() error
	},
	writer *AISDKStreamWriter,
) error {
	defer writer.Close()

	var currentToolCallID string
	var stopReason string

	for stream.Next() {
		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		event := stream.Current()

		// Handle different event types
		switch e := event.AsUnion().(type) {
		case anthropic.ContentBlockStartEvent:
			// Handle start of a new content block (text or tool use)
			// Check if this is a tool use block by checking the Type field
			if e.ContentBlock.Type == "tool_use" || e.ContentBlock.Type == "server_tool_use" {
				// Tool use starting - emit tool call start event
				currentToolCallID = e.ContentBlock.ID
				if err := writer.WriteToolCallStart(e.ContentBlock.ID, e.ContentBlock.Name); err != nil {
					return fmt.Errorf("failed to write tool call start: %w", err)
				}
			}
			// Text blocks don't need special handling - text will come in deltas

		case anthropic.ContentBlockDeltaEvent:
			// Handle delta updates (text or tool arguments)
			// Check the delta type to determine if it's text or tool arguments
			if e.Delta.Type == "text_delta" {
				// Text token received
				if e.Delta.Text != "" {
					if err := writer.WriteTextDelta(e.Delta.Text); err != nil {
						return fmt.Errorf("failed to write text delta: %w", err)
					}
				}
			} else if e.Delta.Type == "input_json_delta" {
				// Tool argument delta - stream partial JSON as it arrives
				if currentToolCallID != "" && e.Delta.PartialJSON != "" {
					if err := writer.WriteToolCallDelta(currentToolCallID, e.Delta.PartialJSON); err != nil {
						return fmt.Errorf("failed to write tool call delta: %w", err)
					}
				}
			}

		case anthropic.ContentBlockStopEvent:
			// Content block finished (text or tool use)
			// Clear current tool call ID when block stops
			currentToolCallID = ""

		case anthropic.MessageStopEvent:
			// Message complete - finish reason will be determined from MessageDeltaEvent

		case anthropic.MessageDeltaEvent:
			// Message-level delta (contains stop reason)
			if e.Delta.StopReason != "" {
				stopReason = string(e.Delta.StopReason)
			}
		}
	}

	// Write finish event
	if stopReason != "" {
		reason := mapAnthropicStopReason(stopReason)
		if err := writer.WriteFinish(reason); err != nil {
			return fmt.Errorf("failed to write finish: %w", err)
		}
	} else {
		// Default to "stop" if no reason provided (fallback for streams that don't send MessageDeltaEvent)
		if err := writer.WriteFinish("stop"); err != nil {
			return fmt.Errorf("failed to write finish: %w", err)
		}
	}

	// Check for stream errors
	if err := stream.Err(); err != nil {
		if writeErr := writer.WriteError(err); writeErr != nil {
			return fmt.Errorf("failed to write error: %w (original: %v)", writeErr, err)
		}
		return err
	}

	return nil
}

// mapAnthropicStopReason converts Anthropic stop reasons to AI SDK format.
func mapAnthropicStopReason(reason string) string {
	switch reason {
	case "end_turn":
		return "stop"
	case "tool_use":
		return "tool-calls"
	case "max_tokens":
		return "length"
	case "stop_sequence":
		return "stop"
	default:
		return "unknown"
	}
}

