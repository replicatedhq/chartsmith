package listener

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/chat"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

func handleNewRevisionNotification(ctx context.Context, id string) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var processingErr error
	defer func() {
		var errorMsg *string
		if processingErr != nil {
			errStr := processingErr.Error()
			errorMsg = &errStr
		}

		_, updateErr := conn.Exec(ctx, `
            UPDATE notification_processing
            SET processed_at = NOW(),
                error = $1
            WHERE notification_channel = $2 and notification_id = $3
        `, errorMsg, "new_revision", id)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new revision notification: %s\n", id)

	idParts := strings.Split(id, "/")
	workspaceID := idParts[0]
	revisionNumber, err := strconv.Atoi(idParts[1])
	if err != nil {
		return fmt.Errorf("error parsing revision number: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	// this is here for when we have a full queue, no
	// reason to process old messages
	if w.CurrentRevision > revisionNumber {
		fmt.Printf("Revision %d is not the current revision for workspace %s\n", revisionNumber, workspaceID)
		return nil
	}

	rev, err := workspace.GetRevision(ctx, workspaceID, revisionNumber)
	if err != nil {
		return fmt.Errorf("error getting revision: %w", err)
	}
	if rev.IsComplete {
		fmt.Printf("Revision %d is already complete for workspace %s\n", revisionNumber, workspaceID)
		return nil
	}

	chatMessage, err := chat.GetChatMessage(ctx, rev.ChatMessageID)
	if err != nil {
		return fmt.Errorf("error getting chat message: %w", err)
	}

	// the response to the chat message on the revision should be a plan to
	// execute on.
	relevantGVKs, err := workspace.ChooseRelevantGVKsForChatMessage(ctx, w, rev.RevisionNumber-1, chatMessage)
	if err != nil {
		return fmt.Errorf("error choosing relevant GVKs: %w", err)
	}

	// get the files from the previous revision for those GVKs
	files, err := workspace.GetFilesForGVKs(ctx, w.ID, rev.RevisionNumber-1, relevantGVKs)
	if err != nil {
		return fmt.Errorf("error getting files for GVKs: %w", err)
	}

	if err := llm.ApplyChangesToWorkspace(ctx, w, rev.RevisionNumber, chatMessage, files); err != nil {
		return fmt.Errorf("error applying changes to workspace: %w", err)
	}

	return nil
}
