package workspace

import (
	"context"
	"fmt"

	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ChooseRelevantFilesForChatMessage(ctx context.Context, w *types.Workspace, chartID string, revisionNumber int, c *chattypes.Chat) ([]types.File, error) {
	relevantFiles, err := FindRelevantFilesForPrompt(ctx, w.ID, chartID, revisionNumber, c.Prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to list relevant files: %w", err)
	}

	return relevantFiles, nil
}
