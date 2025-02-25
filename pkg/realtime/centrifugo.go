package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/realtime/types"
)

var (
	centrifugoConfig *types.Config
)

func Init(c *types.Config) {
	centrifugoConfig = c
}

func SendEvent(ctx context.Context, r types.Recipient, e types.Event) error {
	messageData, err := e.GetMessageData()
	if err != nil {
		return err
	}

	for _, userID := range r.GetUserIDs() {
		userChannelName := fmt.Sprintf("%s#%s", e.GetChannelName(), userID)
		if err := sendMessage(userChannelName, messageData); err != nil {
			logger.Errorf("Failed to send message to user %s: %v", userID, err)
		}
	}

	return nil
}

func sendMessage(channelName string, data map[string]interface{}) error {
	eventType, ok := data["eventType"].(string)
	if ok {
		logger.Infof("Sending event to channel %s: %s", channelName, eventType)
	}

	if centrifugoConfig == nil {
		panic("Centrifugo config not initialized")
	}

	url := centrifugoConfig.Address
	apiKey := centrifugoConfig.APIKey

	requestBody := map[string]interface{}{
		"method": "publish",
		"params": map[string]interface{}{
			"channel": channelName,
			"data":    data,
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		log.Fatalf("Error encoding JSON: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("Error creating request: %v", err)
	}

	fmt.Printf("sending with api key %s\n", apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "apikey "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("Error sending request to Centrifugo server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Fatalf("Failed to send message, status code: %d", resp.StatusCode)
	}

	return nil
}
