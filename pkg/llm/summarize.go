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

// Add rate limiter for Claude API
var (
	// 5 requests per second with burst of 10
	claudeRateLimiter = rate.NewLimiter(rate.Every(200*time.Millisecond), 10)
	// Debug flag to bypass cache
	bypassCache = false // We can set this to false after testing
)

// SummarizeContent will summarize the content of a helm chart file.
// It will first check if the content has already been summarized, and if so, return the cached summary.
// If not, it will summarize the content and cache the result.
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
			logger.Debug("Found cached summary")
			return summary, nil
		}

		if err != pgx.ErrNoRows {
			return "", fmt.Errorf("failed to query summary cache: %w", err)
		}
	}

	logger.Debug("No cached summary found or cache bypassed, summarizing content")

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

func summarizeContentWithClaude(ctx context.Context, content string) (string, error) {
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create anthropic client: %w", err)
	}

	userMessage := "My helm chart includes the following file. Summarize it, including all names, variables, etc that it uses: " + content

	logger.Debug("Sending request to Claude API")
	startTime := time.Now()

	resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F([]anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(userMessage))}),
	})

	if err != nil {
		return "", fmt.Errorf("failed to summarize content: %w", err)
	}

	logger.Debug("Received response from Claude API",
		zap.Duration("duration", time.Since(startTime)))

	return resp.Content[0].Text, nil
}

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
		return "", fmt.Errorf("failed to summarize content: %w", err)
	}

	return strings.TrimSpace(removeThinkingContent(chatCompletion.Choices[0].Message.Content)), nil
}

func removeThinkingContent(input string) string {
	if !strings.Contains(input, "<think>") && !strings.Contains(input, "</think>") {
		return input
	}

	result := input
	for strings.Contains(result, "<think>") && strings.Contains(result, "</think>") {
		beforeThink := strings.Split(result, "<think>")[0]
		afterThinkTag := strings.Split(result, "</think>")[1]
		result = beforeThink + afterThinkTag
	}

	// Handle any remaining single tags
	if strings.Contains(result, "<think>") {
		return "" // Still has an opening tag with no close
	} else if strings.Contains(result, "</think>") {
		return strings.Split(result, "</think>")[1] // Keep only what's after the close tag
	}

	return result
}

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
		return "", fmt.Errorf("failed to summarize content: %w", err)
	}

	return summary, nil
}
