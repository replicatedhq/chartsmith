package chat

import (
	"context"
	"database/sql"

	"github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/tuvistavie/securerandom"
)

func GetChatMessage(ctx context.Context, id string) (*types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace_chat.id,
		workspace_chat.workspace_id,
		workspace_chat.prompt,
		workspace_chat.response,
		workspace_chat.is_complete
	FROM
		workspace_chat
	WHERE
		workspace_chat.id = $1`

	row := conn.QueryRow(ctx, query, id)
	var chat types.Chat
	var response sql.NullString
	err := row.Scan(
		&chat.ID,
		&chat.WorkspaceID,
		&chat.Prompt,
		&response,
		&chat.IsComplete,
	)

	if err != nil {
		return nil, err
	}

	chat.Response = response.String

	return &chat, nil
}

func CreateResponseMessage(ctx context.Context, workspaceID string) (*types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	id, err := securerandom.Hex(12)
	if err != nil {
		return nil, err
	}

	query := `INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, is_complete, is_initial_message)
	VALUES ($1, $2, now(), $3, $4, null, false, true)`

	_, err = conn.Exec(ctx, query, id, workspaceID, "agent", "")
	if err != nil {
		return nil, err
	}

	return GetChatMessage(ctx, id)
}
