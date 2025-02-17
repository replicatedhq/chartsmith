package llm

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/param"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func TestExecuteActionPatchFormat(t *testing.T) {
	tests := []struct {
		name           string
		currentContent string
		plan           string
		path           string
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
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			param.Init(nil)
			ctx := context.Background()
			contentCh := make(chan string, 1)
			doneCh := make(chan error, 1)

			actionPlan := llmtypes.ActionPlanWithPath{
				Path:       tt.path,
				ActionPlan: llmtypes.ActionPlan{},
			}

			plan := &workspacetypes.Plan{
				Description: tt.plan,
			}

			go func() {
				err := ExecuteAction(ctx, actionPlan, plan, tt.currentContent, contentCh, doneCh)
				if err != nil {
					t.Errorf("ExecuteAction failed: %v", err)
				}
			}()

			// Collect the patch
			var lastPatch string
			go func() {
				for {
					select {
					case patch := <-contentCh:
						lastPatch = patch
					case <-time.After(30 * time.Second):
						doneCh <- errors.New("timeout waiting for patch")
					}
				}
			}()

			err := <-doneCh
			if err != nil {
				t.Fatalf("ExecuteAction error: %v", err)
			}
			close(doneCh)

			if lastPatch == "" {
				t.Fatal("no patch received")
			}

			fmt.Printf("\n\n\n %s \n\n\n", lastPatch)

			// Validate the final patch format
			lines := strings.Split(lastPatch, "\n")
			if len(lines) < 4 {
				t.Error("patch too short")
				return
			}

			// Check headers
			if !strings.HasPrefix(lines[0], "--- "+tt.path) {
				t.Errorf("invalid first header: %s", lines[0])
			}
			if !strings.HasPrefix(lines[1], "+++ "+tt.path) {
				t.Errorf("invalid second header: %s", lines[1])
			}

			// Count headers and hunks
			headerCount := 0
			hunkCount := 0
			for _, line := range lines {
				trimmed := strings.TrimSpace(line)
				if strings.HasPrefix(trimmed, "--- ") || strings.HasPrefix(trimmed, "+++ ") {
					headerCount++
				}
				if strings.HasPrefix(trimmed, "@@") {
					hunkCount++
				}
			}

			if headerCount != 2 {
				t.Errorf("wrong number of headers: got %d, want 2", headerCount)
			}
			if hunkCount != 1 {
				t.Errorf("wrong number of hunks: got %d, want 1", hunkCount)
			}

			t.Logf("Generated patch:\n%s", lastPatch)
		})
	}
}
