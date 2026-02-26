// Package agent replaces the custom LLM orchestration in pkg/llm/ with simple
// os/exec calls to an open coding agent CLI (opencode, claude, aider, etc.).
//
// The old pkg/llm/ pipeline (~4K lines) implements:
//   - Intent detection (what does the user want?)
//   - Plan creation (break it into steps)
//   - Action execution (execute each step with tool calls)
//   - Streaming (send partial results to the client)
//
// This package replaces ALL of that with a single exec call. The coding agent
// CLI handles intent detection, planning, and execution internally. We just
// need to: shell out → stream output → collect modified files → validate.
package agent

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Agent wraps an external coding agent CLI tool (opencode, claude, aider).
// Instead of reimplementing LLM orchestration in Go, we delegate to tools
// that already handle tool use, context management, and code editing.
type Agent struct {
	// CLI is the agent binary name: "opencode", "claude", "aider"
	CLI string

	// Model to use (e.g. "claude-sonnet-4-20250514", "gpt-4o")
	Model string

	// SystemPrompt provides Helm-specific context and constraints.
	// See prompts.go for the default.
	SystemPrompt string

	// WorkDir is the chart workspace directory.
	WorkDir string

	// APIKey for the LLM provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
	APIKey string

	// Timeout for the entire agent run. Zero means no timeout.
	Timeout time.Duration
}

// Result captures everything from an agent CLI invocation.
type Result struct {
	// Output is the full stdout from the agent.
	Output string

	// ModifiedFiles lists files that changed during the run.
	ModifiedFiles []string

	// TokensUsed is parsed from CLI output if available (best-effort).
	TokensUsed *TokenUsage

	// ExitCode of the agent process.
	ExitCode int
}

// TokenUsage tracks LLM token consumption, parsed from agent CLI output.
type TokenUsage struct {
	InputTokens  int
	OutputTokens int
}

// Run executes the agent synchronously and returns the result.
func (a *Agent) Run(ctx context.Context, message string) (*Result, error) {
	streamCh := make(chan string, 256)

	// Drain the stream channel in background
	var output strings.Builder
	done := make(chan struct{})
	go func() {
		defer close(done)
		for chunk := range streamCh {
			output.WriteString(chunk)
		}
	}()

	result, err := a.RunStreaming(ctx, message, streamCh)
	<-done

	if result != nil && result.Output == "" {
		result.Output = output.String()
	}
	return result, err
}

// RunStreaming executes the agent and streams stdout chunks to streamCh.
// The channel is closed when the agent finishes. Cancelling ctx kills the process.
func (a *Agent) RunStreaming(ctx context.Context, message string, streamCh chan<- string) (*Result, error) {
	defer close(streamCh)

	if a.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, a.Timeout)
		defer cancel()
	}

	args := a.buildArgs(message)
	cmd := exec.CommandContext(ctx, a.CLI, args...)
	cmd.Dir = a.WorkDir
	cmd.Env = a.buildEnv()

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("creating stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("starting %s: %w", a.CLI, err)
	}

	// Stream stdout line by line
	var output strings.Builder
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text() + "\n"
		output.WriteString(line)
		streamCh <- line
	}

	err = cmd.Wait()

	result := &Result{
		Output:   output.String(),
		ExitCode: cmd.ProcessState.ExitCode(),
	}

	// Best-effort token parsing from stderr/stdout
	result.TokensUsed = parseTokenUsage(stderr.String() + output.String())

	if err != nil && ctx.Err() != nil {
		return result, fmt.Errorf("agent cancelled or timed out: %w", ctx.Err())
	}
	if err != nil {
		return result, fmt.Errorf("agent exited with error: %w (stderr: %s)", err, stderr.String())
	}

	return result, nil
}

// buildArgs constructs CLI arguments based on the agent type.
func (a *Agent) buildArgs(message string) []string {
	switch a.CLI {
	case "claude":
		// Claude Code CLI: claude -p "message" --model model
		args := []string{"-p", message, "--output-format", "text"}
		if a.Model != "" {
			args = append(args, "--model", a.Model)
		}
		if a.SystemPrompt != "" {
			args = append(args, "--system-prompt", a.SystemPrompt)
		}
		return args

	case "opencode":
		// opencode run "message"
		args := []string{"run", message}
		if a.Model != "" {
			args = append(args, "--model", a.Model)
		}
		return args

	case "aider":
		// aider --message "message" --yes-always --no-git
		args := []string{"--message", message, "--yes-always", "--no-git"}
		if a.Model != "" {
			args = append(args, "--model", a.Model)
		}
		return args

	default:
		// Generic: pass message as first arg
		return []string{message}
	}
}

// buildEnv constructs the environment for the agent process.
func (a *Agent) buildEnv() []string {
	env := []string{
		"HOME=" + a.WorkDir,
		"PATH=/usr/local/bin:/usr/bin:/bin",
	}

	if a.APIKey != "" {
		// Set key for all common providers
		env = append(env,
			"ANTHROPIC_API_KEY="+a.APIKey,
			"OPENAI_API_KEY="+a.APIKey,
		)
	}

	return env
}

// tokenPattern matches common token usage output from agent CLIs.
var tokenPattern = regexp.MustCompile(`(?i)(?:input|prompt)\s*tokens?\s*[:=]\s*(\d[\d,]*)`)
var outputTokenPattern = regexp.MustCompile(`(?i)(?:output|completion)\s*tokens?\s*[:=]\s*(\d[\d,]*)`)

// parseTokenUsage attempts to extract token counts from agent output.
func parseTokenUsage(output string) *TokenUsage {
	inputMatch := tokenPattern.FindStringSubmatch(output)
	outputMatch := outputTokenPattern.FindStringSubmatch(output)

	if inputMatch == nil && outputMatch == nil {
		return nil
	}

	usage := &TokenUsage{}
	if inputMatch != nil {
		usage.InputTokens, _ = strconv.Atoi(strings.ReplaceAll(inputMatch[1], ",", ""))
	}
	if outputMatch != nil {
		usage.OutputTokens, _ = strconv.Atoi(strings.ReplaceAll(outputMatch[1], ",", ""))
	}
	return usage
}
