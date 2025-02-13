package workspace

import (
	"context"
	"database/sql"
	"fmt"
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
		workspace_chat.response,
		workspace_chat.created_at,
		workspace_chat.is_intent_complete,
		workspace_chat.is_intent_conversational,
		workspace_chat.is_intent_plan,
		workspace_chat.is_intent_off_topic,
		workspace_chat.is_intent_chart_developer,
		workspace_chat.is_intent_chart_operator,
		workspace_chat.is_intent_proceed,
		workspace_chat.response_render_id
	FROM
		workspace_chat
	WHERE
		workspace_chat.id = $1`

	row := conn.QueryRow(ctx, query, chatMessageId)
	var chat types.Chat
	var response sql.NullString

	var isIntentConversational sql.NullBool
	var isIntentPlan sql.NullBool
	var isIntentOffTopic sql.NullBool
	var isIntentChartDeveloper sql.NullBool
	var isIntentChartOperator sql.NullBool
	var isIntentProceed sql.NullBool
	var responseRenderID sql.NullString
	err := row.Scan(
		&chat.ID,
		&chat.WorkspaceID,
		&chat.Prompt,
		&response,
		&chat.CreatedAt,
		&chat.IsIntentComplete,
		&isIntentConversational,
		&isIntentPlan,
		&isIntentOffTopic,
		&isIntentChartDeveloper,
		&isIntentChartOperator,
		&isIntentProceed,
		&responseRenderID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan chat message: %w", err)
	}

	chat.Response = response.String

	if chat.IsIntentComplete {
		chat.Intent = &types.Intent{
			IsConversational: isIntentConversational.Bool,
			IsPlan:           isIntentPlan.Bool,
			IsOffTopic:       isIntentOffTopic.Bool,
			IsChartDeveloper: isIntentChartDeveloper.Bool,
			IsChartOperator:  isIntentChartOperator.Bool,
			IsProceed:        isIntentProceed.Bool,
		}
	}

	chat.ResponseRenderID = responseRenderID.String

	return &chat, nil
}

func ListChatMessagesForWorkspace(ctx context.Context, workspaceID string) ([]types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
id, prompt, response, created_at,
is_intent_complete, is_intent_conversational, is_intent_plan, is_intent_off_topic, is_intent_chart_developer, is_intent_chart_operator, is_intent_proceed
FROM workspace_chat
WHERE workspace_id = $1
ORDER BY created_at DESC`
	rows, err := conn.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chats []types.Chat
	for rows.Next() {
		var chat types.Chat
		var response sql.NullString
		var isIntentConversational sql.NullBool
		var isIntentPlan sql.NullBool
		var isIntentOffTopic sql.NullBool
		var isIntentChartDeveloper sql.NullBool
		var isIntentChartOperator sql.NullBool
		var isIntentProceed sql.NullBool
		if err := rows.Scan(&chat.ID, &chat.Prompt, &response, &chat.CreatedAt, &chat.IsIntentComplete, &isIntentConversational, &isIntentPlan, &isIntentOffTopic, &isIntentChartDeveloper, &isIntentChartOperator, &isIntentProceed); err != nil {
			return nil, fmt.Errorf("failed to scan chat message: %w", err)
		}

		chat.Response = response.String

		if chat.IsIntentComplete {
			chat.Intent = &types.Intent{
				IsConversational: isIntentConversational.Bool,
				IsPlan:           isIntentPlan.Bool,
				IsOffTopic:       isIntentOffTopic.Bool,
				IsChartDeveloper: isIntentChartDeveloper.Bool,
				IsChartOperator:  isIntentChartOperator.Bool,
				IsProceed:        isIntentProceed.Bool,
			}
		}

		chats = append(chats, chat)
	}

	return chats, nil
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

	query = `SELECT
id, prompt, response, created_at, is_intent_complete, is_intent_conversational, is_intent_plan, is_intent_off_topic, is_intent_chart_developer,
is_intent_chart_operator, is_intent_proceed FROM workspace_chat WHERE workspace_id = $1 AND created_at > $2`
	rows, err := conn.Query(ctx, query, workspaceID, mostRecentChatCreatedAt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chats []types.Chat
	for rows.Next() {
		var chat types.Chat
		var response sql.NullString
		var isIntentConversational sql.NullBool
		var isIntentPlan sql.NullBool
		var isIntentOffTopic sql.NullBool
		var isIntentChartDeveloper sql.NullBool
		var isIntentChartOperator sql.NullBool
		var isIntentProceed sql.NullBool
		err := rows.Scan(&chat.ID, &chat.Prompt, &response, &chat.CreatedAt, &chat.IsIntentComplete, &isIntentConversational, &isIntentPlan, &isIntentOffTopic, &isIntentChartDeveloper, &isIntentChartOperator, &isIntentProceed)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chat message: %w", err)
		}

		chat.Response = response.String

		if chat.IsIntentComplete {
			chat.Intent = &types.Intent{
				IsConversational: isIntentConversational.Bool,
				IsPlan:           isIntentPlan.Bool,
				IsOffTopic:       isIntentOffTopic.Bool,
				IsChartDeveloper: isIntentChartDeveloper.Bool,
				IsChartOperator:  isIntentChartOperator.Bool,
				IsProceed:        isIntentProceed.Bool,
			}
		}

		chats = append(chats, chat)
	}

	return chats, nil
}
