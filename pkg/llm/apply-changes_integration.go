package llm

import (
	"context"
	"fmt"

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

	row := conn.QueryRow(context.Background(), query, "empty-workspace")
	var workspace types.Workspace
	err := row.Scan(
		&workspace.ID,
		&workspace.CreatedAt,
		&workspace.LastUpdatedAt,
		&workspace.Name,
		&workspace.CurrentRevision,
	)
	if err != nil {
		return fmt.Errorf("error scanning workspace: %w", err)
	}

	if workspace.CurrentRevision != 0 {
		return fmt.Errorf("expected current revision to be 0, got %d", workspace.CurrentRevision)
	}

	if workspace.Name != "empty workspace" {
		return fmt.Errorf("expected name to be 'empty workspace', got %s", workspace.Name)
	}
	return nil
}
