package llm

import (
	"strings"
	"testing"

	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParser_ParsePlan(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected HelmResponse
	}{
		{
			name: "parses wordpress plan",
			input: `<chartsmithArtifactPlan id="wordpress-chart-implementation" title="WordPress Helm Chart Implementation Plan">

<chartsmithActionPlan type="file" action="update" path="Chart.yaml">
- Update chart metadata for WordPress
- Add MariaDB dependency
- Set appropriate versions
</chartsmithActionPlan>

<chartsmithActionPlan type="file" action="create" path="templates/wordpress-deployment.yaml">
- Create WordPress deployment template
- Include security contexts
- Add volume mounts
- Configure health checks
</chartsmithActionPlan>`,
			expected: HelmResponse{
				Title: "WordPress Helm Chart Implementation Plan",
				Actions: map[string]types.ActionPlan{
					"Chart.yaml": {
						Type:   "file",
						Action: "update",
					},
					"templates/wordpress-deployment.yaml": {
						Type:   "file",
						Action: "create",
					},
				},
				Artifacts: []types.Artifact{},
			},
		},
		{
			name: "handles unordered attributes and spaces",
			input: `<chartsmithArtifactPlan title="Messy Plan">
<chartsmithActionPlan path=" clean/path.yaml " action = "create" type='file'>
</chartsmithActionPlan>
<chartsmithActionPlan action="update" path='quoted/path.yaml' type="file">
</chartsmithActionPlan>`,
			expected: HelmResponse{
				Title: "Messy Plan",
				Actions: map[string]types.ActionPlan{
					"clean/path.yaml": {
						Type:   "file",
						Action: "create",
					},
					"quoted/path.yaml": {
						Type:   "file",
						Action: "update",
					},
				},
				Artifacts: []types.Artifact{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewParser()
			p.ParsePlan(tt.input)
			result := p.GetResult()

			assert.Equal(t, tt.expected.Title, result.Title, "titles should match")
			
			// Debug print if lengths don't match
			if len(tt.expected.Actions) != len(result.Actions) {
				t.Logf("Expected %d actions, got %d", len(tt.expected.Actions), len(result.Actions))
				for k := range result.Actions {
					t.Logf("Got action: %s", k)
				}
			}
			
			require.Equal(t, len(tt.expected.Actions), len(result.Actions), "should have same number of actions")

			for path, expectedAction := range tt.expected.Actions {
				actualAction, exists := result.Actions[path]
				assert.True(t, exists, "action for path %s should exist", path)
				assert.Equal(t, expectedAction, actualAction, "action for path %s should match", path)
			}
		})
	}
}

func TestParser_ParseArtifacts(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []types.Artifact
	}{
		{
			name: "parses complete Chart.yaml",
			input: `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: wordpress
description: A Helm chart for WordPress
version: 1.0.0
</chartsmithArtifact>`,
			expected: []types.Artifact{
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: wordpress\ndescription: A Helm chart for WordPress\nversion: 1.0.0",
				},
			},
		},
		{
			name: "parses partial artifact",
			input: `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: wordpress
description: A Helm chart`,
			expected: []types.Artifact{
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: wordpress\ndescription: A Helm chart",
				},
			},
		},
		{
			name: "handles multiple artifacts with partial",
			input: `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: chart1
</chartsmithArtifact>
<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: chart2`,
			expected: []types.Artifact{
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: chart1",
				},
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: chart2",
				},
			},
		},
		{
			name: "handles streaming chunks",
			input: `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: wordpr`,
			expected: []types.Artifact{
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: wordpr",
				},
			},
		},
		{
			name: "handles single quotes",
			input: `<chartsmithArtifact path='Chart.yaml'>
apiVersion: v2
name: wordpress`,
			expected: []types.Artifact{
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: wordpress",
				},
			},
		},
		{
			name: "handles spaces around equals",
			input: `<chartsmithArtifact path = "Chart.yaml">
apiVersion: v2
name: wordpress`,
			expected: []types.Artifact{
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: wordpress",
				},
			},
		},
		{
			name: "handles loose spacing and single quotes",
			input: `<chartsmithArtifact path = 'Chart.yaml'>
apiVersion: v2
name: wordpress`,
			expected: []types.Artifact{
				{
					Path:    "Chart.yaml",
					Content: "apiVersion: v2\nname: wordpress",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewParser()
			p.ParseArtifacts(tt.input)
			result := p.GetResult()

			assert.Equal(t, len(tt.expected), len(result.Artifacts), "should have same number of artifacts")
			for i, expectedArtifact := range tt.expected {
				assert.Equal(t, expectedArtifact.Path, result.Artifacts[i].Path, "paths should match")
				assert.Equal(t, strings.TrimSpace(expectedArtifact.Content), strings.TrimSpace(result.Artifacts[i].Content), "content should match")
			}
		})
	}
}
