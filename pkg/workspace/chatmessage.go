package workspace

import (
	"context"
	"database/sql"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func GetChatMessage(ctx context.Context, chatMessageId string) (*types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace_chat.id,
		workspace_chat.workspace_id,
		workspace_chat.prompt,
		workspace_chat.response
	FROM
		workspace_chat
	WHERE
		workspace_chat.id = $1`

	row := conn.QueryRow(ctx, query, chatMessageId)
	var chat types.Chat
	var response sql.NullString
	err := row.Scan(
		&chat.ID,
		&chat.WorkspaceID,
		&chat.Prompt,
		&response,
	)

	if err != nil {
		return nil, err
	}

	chat.Response = response.String

	return &chat, nil
}

func ListChatMessagesAfterPlan(ctx context.Context, planID string) ([]types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT workspace_id, chat_message_ids FROM workspace_plan WHERE id = $1`
	row := conn.QueryRow(ctx, query, planID)

	var workspaceID string
	var chatMessageIds []string
	err := row.Scan(&workspaceID, &chatMessageIds)
	if err != nil {
		return nil, err
	}

	var mostRecentChatCreatedAt *time.Time
	query = `SELECT created_at FROM workspace_chat WHERE id = ANY($1) ORDER BY created_at DESC LIMIT 1`
	row = conn.QueryRow(ctx, query, chatMessageIds)
	err = row.Scan(&mostRecentChatCreatedAt)
	if err != nil {
		return nil, err
	}

	query = `SELECT id, prompt, response FROM workspace_chat WHERE workspace_id = $1 AND created_at > $2`
	rows, err := conn.Query(ctx, query, workspaceID, mostRecentChatCreatedAt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chats []types.Chat
	for rows.Next() {
		var chat types.Chat
		err := rows.Scan(&chat.ID, &chat.Prompt, &chat.Response)
		if err != nil {
			return nil, err
		}
		chats = append(chats, chat)
	}

	return chats, nil
}
