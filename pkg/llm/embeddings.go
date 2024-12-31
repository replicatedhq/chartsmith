package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
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

// Embeddings generates embeddings and returns them in PostgreSQL vector format
func Embeddings(content string) (string, error) {
	if os.Getenv("VOYAGE_API_KEY") == "" {
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
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", os.Getenv("VOYAGE_API_KEY")))

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

	return "[" + strings.Join(strValues, ",") + "]", nil
}
