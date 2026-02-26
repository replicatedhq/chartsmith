package agent

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestBuildArgs_Claude(t *testing.T) {
	a := &Agent{CLI: "claude", Model: "claude-sonnet-4-20250514", SystemPrompt: "you are helpful"}
	args := a.buildArgs("fix the chart")

	if args[0] != "-p" || args[1] != "fix the chart" {
		t.Errorf("expected -p flag with message, got %v", args)
	}
	if !contains(args, "--model") {
		t.Error("expected --model flag")
	}
	if !contains(args, "--system-prompt") {
		t.Error("expected --system-prompt flag")
	}
}

func TestBuildArgs_Aider(t *testing.T) {
	a := &Agent{CLI: "aider", Model: "gpt-4o"}
	args := a.buildArgs("add ingress")

	if args[0] != "--message" || args[1] != "add ingress" {
		t.Errorf("expected --message flag, got %v", args)
	}
	if !contains(args, "--yes-always") {
		t.Error("expected --yes-always flag")
	}
}

func TestBuildArgs_Opencode(t *testing.T) {
	a := &Agent{CLI: "opencode"}
	args := a.buildArgs("hello")

	if args[0] != "run" || args[1] != "hello" {
		t.Errorf("expected run subcommand, got %v", args)
	}
}

func TestParseTokenUsage(t *testing.T) {
	tests := []struct {
		name   string
		output string
		want   *TokenUsage
	}{
		{
			name:   "claude style",
			output: "Input tokens: 1,234\nOutput tokens: 567",
			want:   &TokenUsage{InputTokens: 1234, OutputTokens: 567},
		},
		{
			name:   "no tokens",
			output: "just some output",
			want:   nil,
		},
		{
			name:   "prompt tokens style",
			output: "Prompt Tokens: 500\nCompletion Tokens: 200",
			want:   &TokenUsage{InputTokens: 500, OutputTokens: 200},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseTokenUsage(tt.output)
			if tt.want == nil {
				if got != nil {
					t.Errorf("expected nil, got %+v", got)
				}
				return
			}
			if got == nil {
				t.Fatal("expected non-nil token usage")
			}
			if got.InputTokens != tt.want.InputTokens {
				t.Errorf("input tokens: got %d, want %d", got.InputTokens, tt.want.InputTokens)
			}
			if got.OutputTokens != tt.want.OutputTokens {
				t.Errorf("output tokens: got %d, want %d", got.OutputTokens, tt.want.OutputTokens)
			}
		})
	}
}

func TestWorkspace_ModifiedFiles(t *testing.T) {
	// Create a temp "chart" directory
	srcDir := t.TempDir()
	os.WriteFile(filepath.Join(srcDir, "Chart.yaml"), []byte("name: test\n"), 0o644)
	os.WriteFile(filepath.Join(srcDir, "values.yaml"), []byte("key: value\n"), 0o644)

	ws, err := NewWorkspace(srcDir)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Cleanup()

	// No changes yet
	modified, err := ws.ModifiedFiles()
	if err != nil {
		t.Fatal(err)
	}
	if len(modified) != 0 {
		t.Errorf("expected no modified files, got %v", modified)
	}

	// Modify a file
	os.WriteFile(filepath.Join(ws.Dir, "values.yaml"), []byte("key: changed\n"), 0o644)

	// Add a new file
	os.WriteFile(filepath.Join(ws.Dir, "new.yaml"), []byte("new: file\n"), 0o644)

	modified, err = ws.ModifiedFiles()
	if err != nil {
		t.Fatal(err)
	}
	if len(modified) != 2 {
		t.Errorf("expected 2 modified files, got %v", modified)
	}
}

func TestWorkspace_PathTraversal(t *testing.T) {
	ws := &Workspace{Dir: "/tmp/test"}
	_, err := ws.ReadFile("../../etc/passwd")
	if err == nil {
		t.Error("expected error for path traversal")
	}
}

func TestRunStreaming_NonexistentCLI(t *testing.T) {
	a := &Agent{
		CLI:     "nonexistent-agent-cli-12345",
		WorkDir: t.TempDir(),
		Timeout: 5 * time.Second,
	}

	ch := make(chan string, 10)
	_, err := a.RunStreaming(context.Background(), "hello", ch)
	if err == nil {
		t.Error("expected error for nonexistent CLI")
	}
}

func TestRunStreaming_WithEcho(t *testing.T) {
	// Use "echo" as a fake agent CLI to test streaming
	a := &Agent{
		CLI:     "echo",
		WorkDir: t.TempDir(),
		Timeout: 5 * time.Second,
	}

	ch := make(chan string, 10)
	result, err := a.RunStreaming(context.Background(), "hello world", ch)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d", result.ExitCode)
	}

	// echo receives "hello world" as its argument
	if !strings.Contains(result.Output, "hello world") {
		t.Errorf("expected output to contain 'hello world', got %q", result.Output)
	}
}

func TestRun_Timeout(t *testing.T) {
	a := &Agent{
		CLI:     "sleep",
		WorkDir: t.TempDir(),
		Timeout: 100 * time.Millisecond,
	}

	_, err := a.Run(context.Background(), "60")
	if err == nil {
		t.Error("expected timeout error")
	}
}

func TestDefaultToolConfig(t *testing.T) {
	tc := DefaultToolConfig()
	if !tc.AllowFileWrite || !tc.AllowHelmTemplate || !tc.AllowHelmLint || !tc.AllowArtifactHubSearch {
		t.Error("default config should allow all tools")
	}
}

func TestToolPermissionsPrompt(t *testing.T) {
	tc := DefaultToolConfig()
	prompt := ToolPermissionsPrompt(tc)

	if !strings.Contains(prompt, "File Operations") {
		t.Error("prompt should mention file operations")
	}
	if !strings.Contains(prompt, "helm template") {
		t.Error("prompt should mention helm template")
	}
}

func TestDefaultSystemPrompt(t *testing.T) {
	prompt := DefaultSystemPrompt("my-chart")
	if !strings.Contains(prompt, "my-chart") {
		t.Error("prompt should include chart name")
	}
	if !strings.Contains(prompt, "helm lint") {
		t.Error("prompt should mention helm lint")
	}
}

func TestBuildSystemPrompt(t *testing.T) {
	prompt := BuildSystemPrompt("test", DefaultToolConfig(), "extra info")
	if !strings.Contains(prompt, "extra info") {
		t.Error("prompt should include extra context")
	}
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
