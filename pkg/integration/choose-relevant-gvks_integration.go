package integration

import (
	"context"
	"fmt"

	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

/* Integration test for ChooseRelevantGVKs

This test checks that the chooseRelevantFilesForChatMessage function correctly
selects the relevant GVKs for a given workspace and revision.

We start with a workspace that was prompted to create a basic wordpress chart and
has had that applied. There have been no follow up chat messages yet.

The initial prompt was "create a chart to deploy wordpress in a standard, production grade configuration"
This was applied.

This tests that a prompt of "add an init container to the the wordpress deployment to wait for mysql to be ready"
correctly includes the best GVKs.

*/

func IntegrationTest_ChooseRelevantGVKs() error {
	fmt.Printf("Integration test: ChooseRelevantGVKs\n")

	ctx := context.TODO()

	workspaceID := "nPytmV93RWDx" // feom the exported data

	w, err := workspace.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	c := chattypes.Chat{
		ID:          "chat0001",
		WorkspaceID: workspaceID,
		Prompt:      "add an init container to the the wordpress deployment to wait for mysql to be ready",
		Response:    "",
	}

	gotFiles, err := workspace.ChooseRelevantFilesForChatMessage(ctx, w, "", 0, &c)
	if err != nil {
		return fmt.Errorf("error choosing relevant files: %w", err)
	}

	fmt.Printf("Got %d Files:\n", len(gotFiles))

	// requiredFiles := []string{
	// 	"Chart.yaml",
	// 	"values.yaml",
	// 	"templates/_helpers.tpl",
	// 	"templates/wordpress-statefulset.yaml",
	// }

	return nil
}

func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}
