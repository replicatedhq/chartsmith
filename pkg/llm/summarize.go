package llm

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/jackc/pgx/v5"
	"github.com/jpoz/groq"
	"github.com/ollama/ollama/api"
	ollama "github.com/ollama/ollama/api"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"go.uber.org/zap"
	"golang.org/x/time/rate"
)

// Rate limiter and cache configuration for Claude API
var (
	// claudeRateLimiter limits requests to 5 per second with a burst of 10
	claudeRateLimiter = rate.NewLimiter(rate.Every(200*time.Millisecond), 10)
	// bypassCache is a debug flag to bypass the summary cache for testing
	bypassCache = false
)

// SummarizeContent generates a summary of Helm chart file content using Claude.
// It first checks for a cached summary using a SHA256 hash of the content.
// If no cache is found, it uses Claude to generate a summary and caches the result.
// The function includes retry logic with exponential backoff and rate limiting.
// Returns an empty string if content is empty, or the summary (cached or newly generated).
func SummarizeContent(ctx context.Context, content string) (string, error) {
	if content == "" {
		return "", nil
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	sha256 := sha256.Sum256([]byte(content))

	if !bypassCache {
		query := `SELECT summary FROM summary_cache WHERE content_sha256 = $1`
		row := conn.QueryRow(ctx, query, fmt.Sprintf("%x", sha256))
		var summary string
		err := row.Scan(&summary)
		if err == nil {
			logger.Debug("found cached summary")
			return summary, nil
		}

		if err != pgx.ErrNoRows {
			logger.Error(err,
				zap.String("context", "failed to query summary cache"),
			)
			return "", fmt.Errorf("failed to query summary cache: %w", err)
		}
	}

	logger.Debug("no cached summary found or cache bypassed, summarizing content")

	// Wait for rate limiter
	if err := claudeRateLimiter.Wait(ctx); err != nil {
		return "", fmt.Errorf("rate limiter wait failed: %w", err)
	}

	// Try up to 3 times with exponential backoff
	var summary string
	var lastErr error
	for i := 0; i < 3; i++ {
		var err error
		summary, err = summarizeContentWithClaude(ctx, content)
		if err == nil {
			break
		}
		lastErr = err
		logger.Error(fmt.Errorf("attempt %d failed to summarize content: %w", i+1, err))

		// Exponential backoff: 2s, 4s, 8s
		if i < 2 {
			time.Sleep(time.Duration(2<<i) * time.Second)
			continue
		}
	}

	if lastErr != nil {
		return "", fmt.Errorf("all attempts to summarize content failed: %w", lastErr)
	}

	// Cache the successful result
	insertQuery := `INSERT INTO summary_cache (content_sha256, summary) VALUES ($1, $2)`
	if _, err := conn.Exec(ctx, insertQuery, fmt.Sprintf("%x", sha256), summary); err != nil {
		logger.Error(fmt.Errorf("failed to insert summary into cache: %w", err))
		// Don't return error here, we still have the summary
	}

	return summary, nil
}

// summarizeContentWithClaude sends content to Claude API for summarization.
// This is the primary summarization implementation that uses the Anthropic API.
// It includes detailed logging for request timing and response validation.
func summarizeContentWithClaude(ctx context.Context, content string) (string, error) {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create anthropic client: %w", err)
	}

	userMessage := "My helm chart includes the following file. Summarize it, including all names, variables, etc that it uses: " + content

	logger.Debug("sending request to Claude API")
	startTime := time.Now()

	resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(DefaultModel),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F([]anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage))}),
	})

	if err != nil {
		logger.Error(err,
			zap.String("context", "failed to get response from Claude API"),
			zap.Duration("duration", time.Since(startTime)),
		)
		return "", fmt.Errorf("failed to summarize content with Claude: %w", err)
	}

	if len(resp.Content) == 0 {
		return "", fmt.Errorf("empty response content from Claude API")
	}

	logger.Debug("received response from Claude API",
		zap.Duration("duration", time.Since(startTime)),
		zap.Int("contentBlocks", len(resp.Content)),
	)

	return resp.Content[0].Text, nil
}

// summarizeContentWithGroq sends content to Groq API for summarization.
// This is an alternative implementation using the Groq API with the DeepSeek model.
// Note: This function is not currently used in the main flow but kept for potential fallback.
func summarizeContentWithGroq(ctx context.Context, content string) (string, error) {
	client := groq.NewClient(groq.WithAPIKey(param.Get().GroqAPIKey))

	userMessage := "My helm chart includes the following file. Summarize it, including all names, variables, etc that it uses: " + content

	chatCompletion, err := client.CreateChatCompletion(groq.CompletionCreateParams{
		Model: "deepseek-r1-distill-llama-70b",
		Messages: []groq.Message{
			{
				Role:    "user",
				Content: userMessage,
			},
		},
	})

	if err != nil {
		logger.Error(err,
			zap.String("context", "failed to summarize content with Groq"),
		)
		return "", fmt.Errorf("failed to summarize content with Groq: %w", err)
	}

	return strings.TrimSpace(chatCompletion.Choices[0].Message.Content), nil
}

// summarizeContentWithOllama sends content to Ollama API for summarization.
// This is an alternative implementation using a local Ollama instance with CodeLlama.
// Note: This function is not currently used in the main flow but kept for potential fallback.
func summarizeContentWithOllama(ctx context.Context, content string) (string, error) {
	baseURL, err := url.Parse("https://1732d04b677e.ngrok.app")
	if err != nil {
		return "", fmt.Errorf("failed to parse ollama URL: %w", err)
	}

	client := ollama.NewClient(baseURL, http.DefaultClient)

	userMessage := "My helm chart includes the following file. Summarize it, including all names, variables, etc that it uses: " + content

	req := &ollama.GenerateRequest{
		Model:  "codellama:7b",
		Prompt: userMessage,
		Stream: new(bool),
	}

	var summary string
	respFunc := func(resp api.GenerateResponse) error {
		summary = resp.Response
		return nil
	}

	if err := client.Generate(ctx, req, respFunc); err != nil {
		logger.Error(err,
			zap.String("context", "failed to summarize content with Ollama"),
		)
		return "", fmt.Errorf("failed to summarize content with Ollama: %w", err)
	}

	return summary, nil
}
