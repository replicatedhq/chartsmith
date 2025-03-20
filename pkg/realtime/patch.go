package realtime

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

func SendPatchesToWorkspace(ctx context.Context, workspaceID string, path string, currentContent string, patchesContent []string) error {
	w, err := workspace.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := types.Recipient{
		UserIDs: userIDs,
	}

	e := types.ArtifactUpdatedEvent{
		WorkspaceID: workspaceID,
		Artifact: types.Artifact{
			RevisionNumber: w.CurrentRevision,
			Path:           path,
			Content:        currentContent,
			ContentPending: "",
		},
	}

	if err := SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send artifact update: %w", err)
	}

	return nil
}
