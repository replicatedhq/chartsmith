package agent

// tools.go defines the restricted tool set available to the agent CLI.
//
// When using Claude Code or similar agents, we configure allowed tools via
// the system prompt and CLI flags. This file documents what operations the
// agent is permitted to perform and provides Go helpers for the ones we
// validate server-side.
//
// Available tools for the agent:
//   - File read/write (restricted to workspace directory)
//   - helm template (validate rendering)
//   - helm lint (check chart quality)
//   - Artifact Hub search (find existing charts/examples)
//
// These map to existing ChartSmith capabilities:
//   - helm-utils package for template/lint
//   - recommendations package for Artifact Hub
//   - workspace package for file management

// ToolConfig defines which tools the agent is allowed to use.
type ToolConfig struct {
	// AllowFileWrite permits the agent to create/modify files in the workspace.
	AllowFileWrite bool

	// AllowHelmTemplate permits running helm template for validation.
	AllowHelmTemplate bool

	// AllowHelmLint permits running helm lint for quality checks.
	AllowHelmLint bool

	// AllowArtifactHubSearch permits searching Artifact Hub.
	AllowArtifactHubSearch bool

	// AllowedPaths restricts file operations to these directories.
	// Empty means workspace root only.
	AllowedPaths []string
}

// DefaultToolConfig returns the standard tool configuration for chart editing.
func DefaultToolConfig() ToolConfig {
	return ToolConfig{
		AllowFileWrite:         true,
		AllowHelmTemplate:      true,
		AllowHelmLint:          true,
		AllowArtifactHubSearch: true,
	}
}

// ToolPermissionsPrompt returns a prompt fragment describing allowed tools.
// This is injected into the system prompt so the agent CLI knows its boundaries.
func ToolPermissionsPrompt(tc ToolConfig) string {
	var parts []string

	parts = append(parts, "## Available Tools and Permissions")

	if tc.AllowFileWrite {
		parts = append(parts, `- **File Operations**: You may read and write files within the workspace directory.
  Only modify files under the chart root. Do not create files outside the workspace.`)
	} else {
		parts = append(parts, "- **File Operations**: READ ONLY. Do not modify any files.")
	}

	if tc.AllowHelmTemplate {
		parts = append(parts, `- **helm template**: You can run 'helm template' to validate that templates render correctly.
  Use this to verify your changes produce valid Kubernetes manifests.`)
	}

	if tc.AllowHelmLint {
		parts = append(parts, `- **helm lint**: You can run 'helm lint' to check chart quality and best practices.
  Always lint after making changes.`)
	}

	if tc.AllowArtifactHubSearch {
		parts = append(parts, `- **Artifact Hub**: You can search Artifact Hub for reference charts and examples.
  Use this when you need to see how other charts handle similar patterns.`)
	}

	parts = append(parts, `
## Tool Restrictions
- Do NOT install packages or run arbitrary commands
- Do NOT access the network except via the tools listed above
- Do NOT modify files outside the workspace directory
- Do NOT delete the Chart.yaml or other structural files`)

	result := ""
	for _, p := range parts {
		result += p + "\n\n"
	}
	return result
}
