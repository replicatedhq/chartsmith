package listener

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

type AIChatPayload struct {
	ChatMessageID string `json:"chatMessageId"`
	WorkspaceID   string `json:"workspaceId"`
}

func handleNewAISDKChatNotification(ctx context.Context, payload string) error {
	logger.Debug("Handling new AI SDK chat notification", zap.String("payload", payload))

	var p AIChatPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if p.ChatMessageID == "" {
		return fmt.Errorf("chatMessageId is required")
	}

	// Call the Next.js API route
	appURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	apiURL := fmt.Sprintf("%s/api/chat/conversational", appURL)

	requestBody, err := json.Marshal(map[string]string{
		"chatMessageId": p.ChatMessageID,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	// TODO: Add proper authentication token
	// For now, we'll rely on the API route accepting requests from localhost
	anthropicKey := os.Getenv("ANTHROPIC_API_KEY")
	if anthropicKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", anthropicKey))
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call API route: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API route returned error: %d - %s", resp.StatusCode, string(body))
	}

	logger.Info("Successfully processed AI SDK chat message", zap.String("chatMessageId", p.ChatMessageID))
	return nil
}
