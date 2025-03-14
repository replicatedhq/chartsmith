package llm

import (
	"context"
	"strings"
	"testing"

	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/param"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// normalizeWhitespace removes extra spaces and normalizes line endings
func normalizeWhitespace(s string) string {
	// Replace all whitespace sequences with a single space
	lines := strings.Split(s, "\n")
	var normalized []string

	for _, line := range lines {
		// Skip empty lines
		if strings.TrimSpace(line) == "" {
			normalized = append(normalized, "")
			continue
		}

		// For diff lines (starting with +, -, or space), preserve the prefix
		if strings.HasPrefix(line, "+") || strings.HasPrefix(line, "-") || strings.HasPrefix(line, " ") {
			prefix := line[0:1]
			content := strings.TrimSpace(line[1:])
			normalized = append(normalized, prefix+content)
		} else {
			normalized = append(normalized, strings.TrimSpace(line))
		}
	}

	// Join lines and normalize newlines
	result := strings.Join(normalized, "\n")

	return result
}

// comparePatches compares two patches and returns true if they are equivalent
func comparePatches(expected, actual string) bool {
	// Normalize both patches
	normalizedExpected := normalizeWhitespace(expected)
	normalizedActual := normalizeWhitespace(actual)

	// Trim trailing empty lines
	normalizedExpected = strings.TrimRight(normalizedExpected, "\n")
	normalizedActual = strings.TrimRight(normalizedActual, "\n")

	return normalizedExpected == normalizedActual
}

func TestExecuteActionPatchFormat(t *testing.T) {
	tests := []struct {
		name           string
		currentContent string
		plan           string
		path           string
		expectedPatch  string
	}{
		{
			name: "simple replicaCount change",
			currentContent: `# Default values for empty-chart.
# This is a YAML-formatted file.
# Declare variables to be passed into your templates.

# This will set the replicaset count more information can be found here: https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/
replicaCount: 1

# This sets the container image more information can be found here: https://kubernetes.io/docs/concepts/containers/images/
image:
  pullPolicy: IfNotPresent`,
			plan: "Update replicaCount to 3",
			path: "values.yaml",
			expectedPatch: `--- values.yaml
+++ values.yaml

@@ -1,10 +1,10 @@
 # Default values for empty-chart.
 # This is a YAML-formatted file.
 # Declare variables to be passed into your templates.

 # This will set the replicaset count more information can be found here: https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/
+replicaCount: 3
-replicaCount: 1

 # This sets the container image more information can be found here: https://kubernetes.io/docs/concepts/containers/images/
 image:
   pullPolicy: IfNotPresent`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			param.Init(nil)
			ctx := context.Background()

			actionPlan := llmtypes.ActionPlanWithPath{
				Path: tt.path,
				ActionPlan: llmtypes.ActionPlan{
					Action: "update",
				},
			}

			plan := &workspacetypes.Plan{
				Description: tt.plan,
			}

			patchCh := make(chan string)

			go func() {
				<-patchCh
			}()

			patch, err := ExecuteAction(ctx, actionPlan, plan, tt.currentContent, patchCh)
			if err != nil {
				t.Errorf("ExecuteAction failed: %v", err)
			}

			if !comparePatches(tt.expectedPatch, patch) {
				t.Errorf("Expected patch:\n%s\nbut got:\n%s", tt.expectedPatch, patch)
			}
		})
	}
}
