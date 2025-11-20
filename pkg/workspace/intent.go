package workspace

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func UpdateChatMessageIntent(ctx context.Context, chatMessageID string, intent *types.Intent) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_chat SET is_intent_complete = true,
is_intent_conversational = $1, is_intent_plan = $2,
is_intent_off_topic = $3, is_intent_chart_developer = $4,
is_intent_chart_operator = $5, is_intent_proceed = $6, is_intent_render = $7 WHERE id = $8`
	_, err := conn.Exec(ctx, query, intent.IsConversational, intent.IsPlan, intent.IsOffTopic, intent.IsChartDeveloper, intent.IsChartOperator, intent.IsProceed, intent.IsRender, chatMessageID)
	if err != nil {
		return fmt.Errorf("error updating chat message intent: %w", err)
	}

	return nil
}
