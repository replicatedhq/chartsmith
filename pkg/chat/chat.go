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
		workspace_chat.created_at,
		workspace_chat.sent_by,
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
		&chat.CreatedAt,
		&chat.SentBy,
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
