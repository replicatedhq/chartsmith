package integration

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/chat"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func IntegrationTest_ApplyChangesToWorkspace() error {
	fmt.Printf("Integration test: ApplyChangesToWorkspace\n")

	// connect and list workspaces (test)
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace.id,
		workspace.created_at,
		workspace.last_updated_at,
		workspace.name,
		workspace.current_revision_number
	FROM
		workspace
	WHERE
		workspace.id = $1`

	row := conn.QueryRow(context.Background(), query, "workspace0001")
	var w types.Workspace
	err := row.Scan(
		&w.ID,
		&w.CreatedAt,
		&w.LastUpdatedAt,
		&w.Name,
		&w.CurrentRevision,
	)
	if err != nil {
		return fmt.Errorf("error scanning workspace: %w", err)
	}

	chatMessages, err := chat.ListChatMessagesForWorkspace(context.Background(), w.ID)
	if err != nil {
		return fmt.Errorf("error listing chat messages: %w", err)
	}

	if len(chatMessages) != 1 {
		return fmt.Errorf("expected 1 chat message, got %d", len(chatMessages))
	}

	// c := chatMessages[0]

	// relevantGVKs, err := workspace.ChooseRelevantGVKsForChatMessage(context.Background(), &w, 0, &c)
	// if err != nil {
	// 	return fmt.Errorf("error choosing relevant GVKs: %w", err)
	// }

	// files, err := workspace.GetFilesForGVKs(context.Background(), w.ID, 0, relevantGVKs)
	// if err != nil {
	// 	return fmt.Errorf("error getting files for GVKs: %w", err)
	// }

	// if err := llm.ApplyChangesToWorkspace(context.Background(), &w, 0, &c, files); err != nil {
	// 	return fmt.Errorf("error applying changes to workspace: %w", err)
	// }

	return nil
}
