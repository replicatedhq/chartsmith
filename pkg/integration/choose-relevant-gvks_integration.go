package integration

import (
	"context"
	"fmt"

	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

/* Integration test for ChooseRelevantGVKs

This test checks that the chooseRelevantGVKsForChatMessage function correctly
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

	workspaceID := "TfZJGnk8XzPP" // feom the exported data

	w, err := workspace.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	c := chattypes.Chat{
		ID:          "chat0001",
		WorkspaceID: workspaceID,
		Prompt:      "add an init container to the the wordpress deployment to wait for mysql to be ready",
		Response:    "",
		IsComplete:  false,
		IsApplied:   false,
		IsApplying:  false,
		IsIgnored:   false,
	}

	gotGVKs, err := workspace.ChooseRelevantGVKsForChatMessage(ctx, w, 0, &c)
	if err != nil {
		return fmt.Errorf("error choosing relevant GVKs: %w", err)
	}

	fmt.Printf("Got %d GVKs:\n", len(gotGVKs))

	requiredFiles := []string{
		"Chart.yaml",
		"values.yaml",
		"templates/_helpers.tpl",
		"templates/wordpress-statefulset.yaml",
	}

	// iterate throught the GVKs returned and make a list the required files that we found
	// making sure we don't include duplicated
	var foundFiles []string
	for _, gvk := range gotGVKs {
		for _, file := range requiredFiles {
			if gvk.FilePath == file {
				if !contains(foundFiles, file) {
					foundFiles = append(foundFiles, file)
				}
			}
		}
	}

	if len(foundFiles) != len(requiredFiles) {
		return fmt.Errorf("expected %d files, got %d", len(requiredFiles), len(foundFiles))
	}

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
