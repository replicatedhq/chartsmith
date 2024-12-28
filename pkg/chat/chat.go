package chat

import (
	"context"
	"database/sql"

	"github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
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

func MarkComplete(ctx context.Context, chat *types.Chat) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_chat
	SET response = $1, is_complete = true
	WHERE id = $2`

	_, err := conn.Exec(ctx, query, chat.Response, chat.ID)
	return err
}
