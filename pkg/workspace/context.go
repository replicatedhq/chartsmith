package workspace

import (
	"context"
	"fmt"

	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ChooseRelevantGVKsForChatMessage(ctx context.Context, w *types.Workspace, r *types.Revision, c *chattypes.Chat) ([]types.GVK, error) {
	relevantGVKs, err := FindRelevantGVKsForPrompt(ctx, w.ID, r.RevisionNumber-1, c.Prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to list relevant GVKs: %w", err)
	}

	return relevantGVKs, nil
}
