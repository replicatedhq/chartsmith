package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/tuvistavie/securerandom"
)

var (
	centrifugoConfig *types.Config
)

func Init(c *types.Config) {
	centrifugoConfig = c

	// this needs to be spun off into something that
	// won't run on each replica
	go func() {
		// every 5 seconds, delete the records from the realtime_replay table
		// that are older than 10 seconds
		for {
			func() {
				time.Sleep(5 * time.Second)
				conn := persistence.MustGetPooledPostgresSession()
				defer conn.Release()

				_, err := conn.Exec(context.Background(), `
				DELETE FROM realtime_replay
				WHERE created_at < NOW() - INTERVAL '10 seconds'
			`)
				if err != nil {
					logger.Errorf("Failed to delete old realtime_replay records: %v", err)
				}
			}()
		}
	}()
}

func SendEvent(ctx context.Context, r types.Recipient, e types.Event) error {
	messageData, err := e.GetMessageData()
	if err != nil {
		return err
	}

	for _, userID := range r.GetUserIDs() {
		if err := storeEventForReplay(ctx, r, e, messageData); err != nil {
			logger.Errorf("Failed to store event for replay: %v", err)
		}

		userChannelName := fmt.Sprintf("%s#%s", e.GetChannelName(), userID)
		if err := sendMessage(userChannelName, messageData); err != nil {
			logger.Errorf("Failed to send message to user %s: %v", userID, err)
		}
	}

	return nil
}

func storeEventForReplay(ctx context.Context, r types.Recipient, e types.Event, messageData map[string]interface{}) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	id, err := securerandom.Hex(16)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO realtime_replay (id, created_at, user_id, channel_name, message_data)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err = conn.Exec(ctx, query, id, time.Now(), r.GetUserIDs()[0], e.GetChannelName(), messageData)
	if err != nil {
		return err
	}

	return nil
}

// Ping checks if the realtime system is functioning by making a lightweight API call
func Ping(ctx context.Context) error {
	// Check if database connection is active for realtime events
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Simple query to check database connectivity
	var count int
	err := conn.QueryRow(ctx, "SELECT COUNT(*) FROM realtime_replay LIMIT 1").Scan(&count)
	if err != nil {
		return fmt.Errorf("realtime database check failed: %w", err)
	}

	// Check Centrifugo connectivity with a ping request
	if centrifugoConfig == nil {
		return fmt.Errorf("centrifugo config not initialized")
	}

	// Make a simple info request to centrifugo
	url := centrifugoConfig.Address
	apiKey := centrifugoConfig.APIKey

	requestBody := map[string]interface{}{
		"method": "info",
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("error encoding ping JSON: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("error creating ping request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "apikey "+apiKey)

	// Use a client with a timeout
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error sending ping to Centrifugo server: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("centrifugo ping failed with status code: %d", resp.StatusCode)
	}

	return nil
}

func sendMessage(channelName string, data map[string]interface{}) error {
	if centrifugoConfig == nil {
		panic("Centrifugo config not initialized")
	}

	url := centrifugoConfig.Address
	apiKey := centrifugoConfig.APIKey

	logger.Debugf("Sending Centrifugo message to channel=%s url=%s", channelName, url)

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

	logger.Debugf("Successfully sent Centrifugo message to channel=%s", channelName)

	return nil
}
