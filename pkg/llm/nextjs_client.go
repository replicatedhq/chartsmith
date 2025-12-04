package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type NextJSClient struct {
	baseURL      string
	internalKey  string
	client       *http.Client
}

func NewNextJSClient() *NextJSClient {
		baseURL := os.Getenv("NEXTJS_API_URL")
		if baseURL == "" {
			baseURL = "http://localhost:3000"
		}

		internalKey := os.Getenv("INTERNAL_API_KEY")
		if internalKey == "" {
			internalKey = "dev-internal-key"
		}

	return &NextJSClient{
		baseURL:     baseURL,
		internalKey: internalKey,
		client:      &http.Client{},
	}
}

type PlanRequest struct {
	Prompt       string          `json:"prompt,omitempty"`
	WorkspaceID  string          `json:"workspaceId,omitempty"`
	ChartContext string          `json:"chartContext,omitempty"`
	ModelID      string          `json:"modelId,omitempty"`
	Messages     []MessageParam  `json:"messages,omitempty"`
}

type MessageParam struct {
	Role       string      `json:"role"`
	Content    interface{} `json:"content"`
	ToolCallId string      `json:"toolCallId,omitempty"`
}

type ExpandRequest struct {
	Prompt  string `json:"prompt"`
	ModelID string `json:"modelId,omitempty"`
}

type ExpandResponse struct {
	ExpandedPrompt string `json:"expandedPrompt"`
}

type SummarizeRequest struct {
	Content string `json:"content"`
	Context string `json:"context,omitempty"`
	ModelID string `json:"modelId,omitempty"`
}

type SummarizeResponse struct {
	Summary string `json:"summary"`
}

type CleanupValuesRequest struct {
	ValuesYAML string `json:"valuesYAML"`
	ModelID    string `json:"modelId,omitempty"`
}

type CleanupValuesResponse struct {
	CleanedYAML string `json:"cleanedYAML"`
}

type ConversationalRequest struct {
	Messages    []MessageParam `json:"messages"`
	WorkspaceID string         `json:"workspaceId"`
	ModelID     string         `json:"modelId,omitempty"`
}

type ExecuteActionRequest struct {
	Messages []MessageParam `json:"messages"`
	ModelID  string         `json:"modelId,omitempty"`
}

type ToolCall struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Args     string `json:"args"`
}

type ExecuteActionResponse struct {
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"toolCalls,omitempty"`
}

func (c *NextJSClient) StreamPlan(ctx context.Context, req PlanRequest) (<-chan string, <-chan error) {
	return c.postStream(ctx, "/api/llm/plan", req)
}

func (c *NextJSClient) ExpandPrompt(ctx context.Context, req ExpandRequest) (string, error) {
	var resp ExpandResponse
	if err := c.post(ctx, "/api/llm/expand", req, &resp); err != nil {
		return "", err
	}
	return resp.ExpandedPrompt, nil
}

func (c *NextJSClient) Summarize(ctx context.Context, req SummarizeRequest) (string, error) {
	var resp SummarizeResponse
	if err := c.post(ctx, "/api/llm/summarize", req, &resp); err != nil {
		return "", err
	}
	return resp.Summary, nil
}

func (c *NextJSClient) CleanupValues(ctx context.Context, req CleanupValuesRequest) (string, error) {
	var resp CleanupValuesResponse
	if err := c.post(ctx, "/api/llm/cleanup-values", req, &resp); err != nil {
		return "", err
	}
	return resp.CleanedYAML, nil
}

func (c *NextJSClient) StreamConversational(ctx context.Context, req ConversationalRequest) (<-chan string, <-chan error) {
	return c.postStream(ctx, "/api/chat", req)
}

func (c *NextJSClient) ExecuteAction(ctx context.Context, req ExecuteActionRequest) (string, []ToolCall, error) {
	var resp ExecuteActionResponse
	if err := c.post(ctx, "/api/llm/execute-action", req, &resp); err != nil {
		return "", nil, err
	}
	return resp.Content, resp.ToolCalls, nil
}

func (c *NextJSClient) post(ctx context.Context, path string, req any, resp any) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Internal-API-Key", c.internalKey)

	r, err := c.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to call Next.js API: %w", err)
	}
	defer r.Body.Close()

	if r.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(r.Body)
		return fmt.Errorf("Next.js API error: %s - %s", r.Status, string(body))
	}

	if err := json.NewDecoder(r.Body).Decode(resp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	return nil
}

func (c *NextJSClient) postStream(ctx context.Context, path string, req any) (<-chan string, <-chan error) {
	textCh := make(chan string, 100)
	errCh := make(chan error, 1)

	go func() {
		defer close(textCh)
		defer close(errCh)

		body, err := json.Marshal(req)
		if err != nil {
			errCh <- fmt.Errorf("failed to marshal request: %w", err)
			return
		}

		httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bytes.NewReader(body))
		if err != nil {
			errCh <- fmt.Errorf("failed to create request: %w", err)
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("X-Internal-API-Key", c.internalKey)

		resp, err := c.client.Do(httpReq)
		if err != nil {
			errCh <- fmt.Errorf("failed to call Next.js API: %w", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			errCh <- fmt.Errorf("Next.js API error: %s - %s", resp.Status, string(body))
			return
		}

		// Parse streaming response
		c.parseStream(resp.Body, textCh, errCh)
	}()

	return textCh, errCh
}

func (c *NextJSClient) parseStream(body io.Reader, textCh chan<- string, errCh chan<- error) {
	buf := make([]byte, 64)

	for {
		n, err := body.Read(buf)
		if n > 0 {
			textCh <- string(buf[:n])
		}

		if err == io.EOF {
			return
		}

		if err != nil {
			errCh <- fmt.Errorf("error reading stream: %w", err)
			return
		}
	}
}