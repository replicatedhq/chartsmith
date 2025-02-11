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
		return "", ErrEmptyContent
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

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request error: %v", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("response read error: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, body)
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
