package llm

import (
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
				Files: []types.HelmFile{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewParser()
			p.ParsePlan(tt.input)
			result := p.GetResult()

			assert.Equal(t, tt.expected.Title, result.Title, "titles should match")
			require.Equal(t, len(tt.expected.Actions), len(result.Actions), "should have same number of actions")

			for path, expectedAction := range tt.expected.Actions {
				actualAction, exists := result.Actions[path]
				assert.True(t, exists, "action for path %s should exist", path)
				assert.Equal(t, expectedAction, actualAction, "action for path %s should match", path)
			}
		})
	}
}
