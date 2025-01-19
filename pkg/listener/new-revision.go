package listener

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/chat"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"gopkg.in/yaml.v2"
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

	relevantCharts := []workspacetypes.Chart{
		w.Charts[0],
	}

	chartIDNameMap := map[string]string{}

	for _, chart := range relevantCharts {
		relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(ctx, w, chart.ID, rev.RevisionNumber, chatMessage)
		if err != nil {
			return fmt.Errorf("error choosing relevant files: %w", err)
		}

		updatedChartFiles, err := llm.ApplyPlanToChart(ctx, w, &chart, rev.RevisionNumber, chatMessage, relevantFiles)
		if err != nil {
			return fmt.Errorf("error applying changes to workspace: %w", err)
		}

		// update "w" with the new files
		for i, c := range w.Charts {
			if c.ID == chart.ID {
				w.Charts[i].Files = updatedChartFiles

				for _, file := range updatedChartFiles {
					if file.FilePath == "Chart.yaml" {
						// yaml unmarshal it
						var chartYaml map[string]interface{}
						err := yaml.Unmarshal([]byte(file.Content), &chartYaml)
						if err != nil {
							return fmt.Errorf("error unmarshalling chart.yaml: %w", err)
						}
						chartIDNameMap[chart.ID] = chartYaml["name"].(string)

						w.Charts[i].Name = chartYaml["name"].(string)
					}
				}
			}
		}

	}

	// mark the chat as complete and applied, add files to the workspace, and set the current revision to what we just created
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	for id, name := range chartIDNameMap {
		if err := workspace.SetChartName(ctx, tx, w.ID, id, name, rev.RevisionNumber); err != nil {
			return fmt.Errorf("error setting chart name: %w", err)
		}
	}

	if err := workspace.SetFilesInWorkspace(ctx, tx, w, rev.RevisionNumber); err != nil {
		return fmt.Errorf("error adding files to workspace: %w", err)
	}

	if err := chat.MarkComplete(ctx, tx, chatMessage); err != nil {
		return fmt.Errorf("error marking chat message as complete: %w", err)
	}
	if err := chat.MarkApplied(ctx, tx, chatMessage); err != nil {
		return fmt.Errorf("error marking chat message as applied: %w", err)
	}

	_, err = workspace.SetCurrentRevision(ctx, tx, w, revisionNumber)
	if err != nil {
		return fmt.Errorf("error setting current revision: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	refetchedWorkspace, err := workspace.GetWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	e := realtimetypes.WorkspaceRevisionCompletedEvent{
		Workspace: refetchedWorkspace,
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error listing user IDs for workspace: %w", err)
	}

	recipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	if err := realtime.SendEvent(ctx, recipient, e); err != nil {
		return fmt.Errorf("error sending workspace revision completed event: %w", err)
	}

	return nil
}
