package chat

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

func SetFilesSentForChatMessage(ctx context.Context, workspaceID string, chatID string, files []string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `UPDATE workspace_chat SET files_sent = $1 WHERE workspace_id = $2 AND id = $3`
	_, err = conn.Exec(ctx, query, files, workspaceID, chatID)
	if err != nil {
		return fmt.Errorf("error updating files sent: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}

func ListChatMessagesForWorkspaceSinceRevision(ctx context.Context, workspaceID string, revision int) ([]types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// get the chat id that created the current revision
	query := `SELECT
		workspace_revision.chat_message_id
	FROM
		workspace_revision
	WHERE
		workspace_revision.workspace_id = $1 AND
		workspace_revision.revision_number = $2`

	row := conn.QueryRow(ctx, query, workspaceID, revision)
	var chatID string
	err := row.Scan(&chatID)
	if err != nil {
		return nil, fmt.Errorf("error scanning chat id: %w", err)
	}

	query = `SELECT
		workspace_chat.id,
		workspace_chat.workspace_id,
		workspace_chat.prompt,
		workspace_chat.response,
		workspace_chat.is_complete,
		workspace_chat.is_applied,
		workspace_chat.is_applying,
		workspace_chat.is_ignored
	FROM
		workspace_chat
	WHERE
		workspace_chat.workspace_id = $1 AND
		workspace_chat.created_at > (SELECT created_at FROM workspace_revision WHERE workspace_id = $1 AND chat_message_id = $2)`

	rows, err := conn.Query(ctx, query, workspaceID, chatID)
	if err != nil {
		return nil, fmt.Errorf("error listing chat messages: %w", err)
	}

	defer rows.Close()

	var messages []types.Chat
	for rows.Next() {
		var message types.Chat
		var response sql.NullString
		err := rows.Scan(
			&message.ID,
			&message.WorkspaceID,
			&message.Prompt,
			&response,
			&message.IsComplete,
			&message.IsApplied,
			&message.IsApplying,
			&message.IsIgnored,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning chat message: %w", err)
		}

		message.Response = response.String
		messages = append(messages, message)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating chat messages: %w", err)
	}

	return messages, nil
}

func ListChatMessagesForWorkspace(ctx context.Context, workspaceID string) ([]types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace_chat.id,
		workspace_chat.workspace_id,
		workspace_chat.prompt,
		workspace_chat.response,
		workspace_chat.is_complete,
		workspace_chat.is_applied,
		workspace_chat.is_applying,
		workspace_chat.is_ignored
	FROM
		workspace_chat
	WHERE
		workspace_chat.workspace_id = $1`

	rows, err := conn.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var chats []types.Chat
	for rows.Next() {
		var chat types.Chat
		var response sql.NullString
		err := rows.Scan(
			&chat.ID,
			&chat.WorkspaceID,
			&chat.Prompt,
			&response,
			&chat.IsComplete,
			&chat.IsApplied,
			&chat.IsApplying,
			&chat.IsIgnored,
		)
		if err != nil {
			return nil, err
		}

		chat.Response = response.String
		chats = append(chats, chat)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return chats, nil
}

func GetChatMessage(ctx context.Context, id string) (*types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
		workspace_chat.id,
		workspace_chat.workspace_id,
		workspace_chat.prompt,
		workspace_chat.response,
		workspace_chat.is_complete,
		workspace_chat.is_applied,
		workspace_chat.is_applying,
		workspace_chat.is_ignored
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
		&chat.IsApplied,
		&chat.IsApplying,
		&chat.IsIgnored,
	)

	if err != nil {
		return nil, err
	}

	chat.Response = response.String

	return &chat, nil
}

func SetResponse(ctx context.Context, tx pgx.Tx, c *types.Chat) error {
	query := `UPDATE workspace_chat
	SET response = $1
	WHERE id = $2`

	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		_, err := conn.Exec(ctx, query, c.Response, c.ID)
		if err != nil {
			return fmt.Errorf("error setting response: %w", err)
		}
		return nil
	} else {
		_, err := tx.Exec(ctx, query, c.Response, c.ID)
		if err != nil {
			return fmt.Errorf("error setting response: %w", err)
		}
		return nil
	}
}

func MarkComplete(ctx context.Context, tx pgx.Tx, chat *types.Chat) error {
	query := `UPDATE workspace_chat
	SET is_complete = true, is_ignored = false
	WHERE id = $1`

	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		_, err := conn.Exec(ctx, query, chat.ID)
		if err != nil {
			return fmt.Errorf("error marking chat message as complete: %w", err)
		}
		return nil
	} else {
		_, err := tx.Exec(ctx, query, chat.ID)
		if err != nil {
			return fmt.Errorf("error marking chat message as complete: %w", err)
		}
		return nil
	}
}

func MarkApplying(ctx context.Context, tx pgx.Tx, chat *types.Chat) error {
	query := `UPDATE workspace_chat
	SET is_applying = true, is_applied = false, is_ignored = false
	WHERE id = $1`

	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		_, err := conn.Exec(ctx, query, chat.ID)
		if err != nil {
			return fmt.Errorf("error marking chat message as applying: %w", err)
		}
		return nil
	} else {
		_, err := tx.Exec(ctx, query, chat.ID)
		if err != nil {
			return fmt.Errorf("error marking chat message as applying: %w", err)
		}
		return nil
	}
}

func MarkApplied(ctx context.Context, tx pgx.Tx, chat *types.Chat) error {
	query := `UPDATE workspace_chat
	SET is_applied = true, is_applying = false, is_ignored = false
	WHERE id = $1`

	if tx == nil {
		conn := persistence.MustGetPooledPostgresSession()
		defer conn.Release()

		_, err := conn.Exec(ctx, query, chat.ID)
		if err != nil {
			return fmt.Errorf("error marking chat message as applied: %w", err)
		}
		return nil
	} else {
		_, err := tx.Exec(ctx, query, chat.ID)
		if err != nil {
			return fmt.Errorf("error marking chat message as applied: %w", err)
		}
		return nil
	}
}
