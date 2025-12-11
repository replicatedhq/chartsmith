package embedding

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"

type embeddingRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type embeddingResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
}

var ErrEmptyContent = errors.New("content is empty")

// Embeddings generates embeddings and returns them in PostgreSQL vector format
func Embeddings(content string) (string, error) {
	if content == "" {
		return "", nil
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	contentSHA256 := sha256.Sum256([]byte(content))
	query := `select embeddings from content_cache where content_sha256 = $1`
	row := conn.QueryRow(context.Background(), query, fmt.Sprintf("%x", contentSHA256))
	var cachedEmbeddings string
	if err := row.Scan(&cachedEmbeddings); err != nil {
		if err != pgx.ErrNoRows {
			return "", fmt.Errorf("error scanning embeddings: %v", err)
		}
	} else {
		return cachedEmbeddings, nil
	}

	if param.Get().VoyageAPIKey == "" {
		return "", fmt.Errorf("VOYAGE_API_KEY environment variable not set")
	}

	reqBody := embeddingRequest{
		Model: "voyage-01",
		Input: []string{content},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal error: %v", err)
	}

	req, err := http.NewRequest("POST", VOYAGE_API_URL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("request creation error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", param.Get().VoyageAPIKey))

	// Retry logic for rate limiting (429 errors)
	maxRetries := 5
	baseDelay := 20 * time.Second // Start with 20 seconds for 3 RPM limit
	var resp *http.Response
	var body []byte

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 20s, 40s, 60s, 80s, 100s
			delay := time.Duration(attempt) * baseDelay
			fmt.Printf("Rate limited, waiting %v before retry %d/%d...\n", delay, attempt+1, maxRetries)
			time.Sleep(delay)
			
			// Recreate request for retry (body buffer gets consumed)
			req, err = http.NewRequest("POST", VOYAGE_API_URL, bytes.NewBuffer(jsonData))
			if err != nil {
				return "", fmt.Errorf("request creation error: %v", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", param.Get().VoyageAPIKey))
		}

		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			return "", fmt.Errorf("request error: %v", err)
		}

		body, err = ioutil.ReadAll(resp.Body)
		resp.Body.Close() // Close immediately after reading
		if err != nil {
			return "", fmt.Errorf("response read error: %v", err)
		}

		// If we get a 429 (rate limit), retry
		if resp.StatusCode == http.StatusTooManyRequests {
			if attempt < maxRetries-1 {
				continue
			}
			// Last attempt failed
			return "", fmt.Errorf("API error %d (rate limited, max retries exceeded): %s", resp.StatusCode, body)
		}

		// If we get any other error, don't retry
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("API error %d: %s", resp.StatusCode, body)
		}

		// Success!
		break
	}

	var embeddings embeddingResponse
	if err := json.Unmarshal(body, &embeddings); err != nil {
		return "", fmt.Errorf("unmarshal error: %v", err)
	}

	if len(embeddings.Data) == 0 {
		return "", fmt.Errorf("no embeddings generated")
	}

	// Convert float64 slice to PostgreSQL vector format
	strValues := make([]string, len(embeddings.Data[0].Embedding))
	for i, v := range embeddings.Data[0].Embedding {
		strValues[i] = fmt.Sprintf("%.6f", v)
	}

	newEmbeddings := "[" + strings.Join(strValues, ",") + "]"

	query = `insert into content_cache (content_sha256, embeddings) values ($1, $2) on conflict (content_sha256) do update set embeddings = $2`
	_, err = conn.Exec(context.Background(), query, fmt.Sprintf("%x", contentSHA256), newEmbeddings)
	if err != nil {
		return "", fmt.Errorf("error inserting embeddings: %v", err)
	}

	return newEmbeddings, nil
}
