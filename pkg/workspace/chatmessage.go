package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
)

// CreateChatMessage in the go code is only used by the debugcli
func CreateChatMessage(ctx context.Context, workspaceID string, prompt string) (*types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	w, err := GetWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get workspace: %w", err)
	}

	id, err := securerandom.Hex(12)
	if err != nil {
		return nil, fmt.Errorf("failed to generate random ID: %w", err)
	}

	query := `INSERT INTO workspace_chat (
        id,
        workspace_id,
        created_at,
        sent_by,
        prompt,
        response,
        revision_number,
        is_canceled,
        is_intent_complete,
        is_intent_conversational,
        is_intent_plan,
        is_intent_off_topic,
        is_intent_chart_developer,
        is_intent_chart_operator,
        is_intent_render,
        followup_actions,
        response_render_id,
        response_plan_id,
        response_conversion_id,
        response_rollback_to_revision_number
      )
      VALUES (
        $1, $2, now(), $3, $4, $5, $6,
		false,
		true,
		false,
		true,
		false,
		true,
		false,
		false,
		null,
		false,
		false,
		false,
		null)`
	_, err = conn.Exec(ctx, query, id, workspaceID, "debugcli", prompt, "", w.CurrentRevision)
	if err != nil {
		return nil, fmt.Errorf("failed to insert chat message: %w", err)
	}

	return GetChatMessage(ctx, id)
}

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
		workspace_chat.response_render_id,
		workspace_chat.response_plan_id,
		workspace_chat.response_conversion_id,
		workspace_chat.response_rollback_to_revision_number,
		workspace_chat.revision_number
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
	var responsePlanID sql.NullString
	var responseConversionID sql.NullString
	var responseRollbackToRevisionNumber sql.NullInt64
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
		&responsePlanID,
		&responseConversionID,
		&responseRollbackToRevisionNumber,
		&chat.RevisionNumber,
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
	chat.ResponsePlanID = responsePlanID.String
	chat.ResponseConversionID = responseConversionID.String

	if responseRollbackToRevisionNumber.Valid {
		val := int(responseRollbackToRevisionNumber.Int64)
		chat.ResponseRollbackToRevisionNumber = &val
	}

	return &chat, nil
}

func ListChatMessagesForWorkspace(ctx context.Context, workspaceID string) ([]types.Chat, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT
id, prompt, response, created_at,
is_intent_complete, is_intent_conversational, is_intent_plan, is_intent_off_topic, is_intent_chart_developer, is_intent_chart_operator, is_intent_proceed, revision_number
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

// SetChatMessageIntent updates the intent flags for a chat message
func SetChatMessageIntent(ctx context.Context, chatMessageID string, isIntentComplete bool, isConversational bool, isPlan bool, isOffTopic bool, isProceed bool) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_chat SET
		is_intent_complete = $1,
		is_intent_conversational = $2,
		is_intent_plan = $3,
		is_intent_off_topic = $4,
		is_intent_proceed = $5
	WHERE id = $6`

	_, err := conn.Exec(ctx, query, isIntentComplete, isConversational, isPlan, isOffTopic, isProceed, chatMessageID)
	if err != nil {
		return fmt.Errorf("failed to update chat message intent: %w", err)
	}

	return nil
}
