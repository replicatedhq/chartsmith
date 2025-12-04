package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
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
	env := os.Getenv("GO_ENV")

	// In production, INTERNAL_API_KEY is required - fail hard if not set
	if internalKey == "" {
		if env == "production" {
			panic("INTERNAL_API_KEY environment variable is required in production")
		}
		// Only use default key in development
		internalKey = "dev-internal-key"
	}

	// Warn if using default key with a non-localhost URL (possible misconfiguration)
	if internalKey == "dev-internal-key" && baseURL != "http://localhost:3000" {
		fmt.Fprintf(os.Stderr, "WARNING: Using default dev-internal-key with non-localhost URL (%s). "+
			"This may indicate a misconfiguration. Set INTERNAL_API_KEY for production.\n", baseURL)
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

// parseStream parses the Vercel AI SDK text stream format.
// The format uses line-based messages with type prefixes:
//   - "0:" prefix for text deltas, followed by a JSON-encoded string
//   - "e:" prefix for error/finish events
//   - "d:" prefix for done events
//
// Example stream:
//
//	0:"Here is "
//	0:"the plan"
//	0:" for your chart"
//	e:{"finishReason":"stop"}
//	d:{"finishReason":"stop"}
func (c *NextJSClient) parseStream(body io.Reader, textCh chan<- string, errCh chan<- error) {
	scanner := bufio.NewScanner(body)
	// Increase buffer size for potentially long lines
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()

		// Skip empty lines (keep-alives)
		if line == "" {
			continue
		}

		// Parse Vercel AI SDK format: "0:\"text content\""
		// The prefix "0:" indicates a text delta
		if strings.HasPrefix(line, "0:") {
			// Extract the JSON string after "0:"
			jsonStr := line[2:]

			// The content is a JSON-encoded string (e.g., "\"Hello\"")
			var text string
			if err := json.Unmarshal([]byte(jsonStr), &text); err != nil {
				// If JSON parsing fails, try using the raw content
				// This handles edge cases where the content might not be properly escaped
				text = jsonStr
			}

			if text != "" {
				textCh <- text
			}
			continue
		}

		// Handle other prefixes (e:, d:, etc.) - these are control messages
		// "e:" - finish event with metadata
		// "d:" - done event
		// We can safely ignore these for text extraction
		if strings.HasPrefix(line, "e:") || strings.HasPrefix(line, "d:") {
			// Control messages, skip
			continue
		}

		// Handle SSE format (data: prefix) as fallback
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")

			// Skip [DONE] marker
			if data == "[DONE]" {
				continue
			}

			// Try to parse as JSON with a "text" field
			var event struct {
				Text string `json:"text"`
				Type string `json:"type"`
			}
			if err := json.Unmarshal([]byte(data), &event); err == nil {
				if event.Text != "" {
					textCh <- event.Text
				}
			}
			continue
		}

		// For any unrecognized format, log but don't fail
		// This makes the parser more resilient to format changes
	}

	if err := scanner.Err(); err != nil {
		errCh <- fmt.Errorf("error reading stream: %w", err)
	}
}