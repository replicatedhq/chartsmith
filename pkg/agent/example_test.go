package agent_test

import (
	"context"
	"fmt"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/agent"
)

// Example_oldVsNew demonstrates the architectural shift from the old
// pkg/llm/ pipeline to the new agent exec approach.
//
// OLD FLOW (pkg/llm/ - ~4K lines):
//
//	1. intent.go      → Classify user intent (LLM call #1)
//	2. plan.go        → Generate execution plan (LLM call #2)
//	3. execute-plan.go → Execute each step (LLM calls #3..N)
//	4. execute-action.go → Run tools for each action
//	5. parser.go      → Parse LLM responses for file changes
//	6. artifacts.go   → Extract and apply file modifications
//	7. streaming throughout via Centrifugo
//
// NEW FLOW (pkg/agent/ - ~500 lines):
//
//	1. agent.Run(ctx, message) → Single exec call to coding agent
//	2. validate.Validate()     → helm lint + helm template
//	3. Done.
//
// The coding agent CLI (claude, opencode, aider) handles intent detection,
// planning, and execution internally. We don't need to reimplement that.
func Example_oldVsNew() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Configure the agent
	a := &agent.Agent{
		CLI:          "claude",
		Model:        "claude-sonnet-4-20250514",
		SystemPrompt: agent.BuildSystemPrompt("my-app", agent.DefaultToolConfig(), ""),
		WorkDir:      "/tmp/chart-workspace",
		Timeout:      5 * time.Minute,
	}

	// Stream results to the user (replaces Centrifugo streaming in pkg/llm/)
	streamCh := make(chan string, 256)
	go func() {
		for chunk := range streamCh {
			// In production: send via Centrifugo to the frontend
			_ = chunk
		}
	}()

	// Single call replaces the entire intent → plan → execute pipeline
	result, err := a.RunStreaming(ctx, "Add an HPA that scales from 2 to 10 replicas based on CPU", streamCh)
	if err != nil {
		fmt.Printf("Agent error: %v\n", err)
		return
	}

	// Validate the result (replaces scattered validation in pkg/llm/)
	validation, err := agent.Validate(ctx, a.WorkDir)
	if err != nil {
		fmt.Printf("Validation error: %v\n", err)
		return
	}

	if !validation.IsValid() {
		// Optionally retry with validation errors
		validation, _ = agent.ValidateAndRetry(ctx, a, a.WorkDir, 2)
	}

	fmt.Printf("Exit code: %d, Valid: %v\n", result.ExitCode, validation.IsValid())
}
