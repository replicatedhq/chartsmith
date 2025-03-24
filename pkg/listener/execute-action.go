package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

var (
	heartbeatOnce sync.Once
	heartbeatDone chan struct{}
)

type executeActionPayload struct {
	PlanID string `json:"planId"`
	Path   string `json:"path"`
}

// StartHeartbeat initiates a goroutine that periodically pings database connections
// to prevent them from becoming stale during idle periods
func StartHeartbeat(ctx context.Context) {
	heartbeatOnce.Do(func() {
		// Create a buffered channel to avoid leaking goroutines
		heartbeatDone = make(chan struct{})

		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case <-ticker.C:
					// Perform health check
					if err := ensureActiveConnection(ctx); err != nil {
						logger.Warn("Connection heartbeat check failed", zap.Error(err))
					}

					// Also check if the realtime system is functioning
					if err := realtime.Ping(ctx); err != nil {
						logger.Warn("Realtime system heartbeat check failed", zap.Error(err))
					}

				case <-ctx.Done():
					logger.Info("Stopping connection heartbeat due to context cancellation")
					close(heartbeatDone)
					return

				case <-heartbeatDone:
					logger.Info("Stopping connection heartbeat")
					return
				}
			}
		}()

		logger.Info("Started connection heartbeat")
	})
}

func handleExecuteActionNotification(ctx context.Context, payload string) error {
	logger.Info("New execute action notification received", zap.String("payload", payload))

	// Verify connection is active before proceeding
	if err := ensureActiveConnection(ctx); err != nil {
		logger.Error(fmt.Errorf("connection check failed before processing action notification: %w", err))
		// Continue anyway, we'll use a fresh connection below
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	var p executeActionPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	plan, err := workspace.GetPlan(ctx, nil, p.PlanID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	// find the action, confirm it's still pending for now
	actionFound := false

	for i, item := range plan.ActionFiles {
		if item.Path == p.Path {
			actionFound = true

			if item.Status != string(llmtypes.ActionPlanStatusPending) {
				return nil
			}

			item.Status = string(llmtypes.ActionPlanStatusCreating)
			plan.ActionFiles[i] = item
			break
		}
	}

	if !actionFound {
		return fmt.Errorf("action not found in plan for path %s", p.Path)
	}

	if err := workspace.UpdatePlanActionFiles(ctx, tx, plan.ID, plan.ActionFiles); err != nil {
		return fmt.Errorf("failed to update plan: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	conn.Release()

	w, err := workspace.GetWorkspace(ctx, plan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	updatedPlan, err := workspace.GetPlan(ctx, nil, plan.ID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, updatedPlan.WorkspaceID)
	if err != nil {
		return fmt.Errorf("error getting user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	e := realtimetypes.PlanUpdatedEvent{
		WorkspaceID: updatedPlan.WorkspaceID,
		Plan:        updatedPlan,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send plan update: %w", err)
	}

	currentContent := ""
	c := w.Charts[0]
	for _, file := range c.Files {
		if file.FilePath == p.Path {
			currentContent = file.Content
			break
		}
	}

	interimContentCh := make(chan string)
	finalContentCh := make(chan string)
	errCh := make(chan error)

	go func() {
		action := ""

		for _, item := range plan.ActionFiles {
			if item.Path == p.Path {
				action = item.Action
				break
			}
		}

		apwp := llmtypes.ActionPlanWithPath{
			ActionPlan: llmtypes.ActionPlan{
				Action: action,
				Type:   "file",
				Status: llmtypes.ActionPlanStatusPending,
			},
			Path: p.Path,
		}

		finalContent, err := llm.ExecuteAction(ctx, apwp, plan, currentContent, interimContentCh)
		if err != nil {
			errCh <- fmt.Errorf("failed to execute action: %w", err)
			return
		}

		finalContentCh <- finalContent
		errCh <- nil
	}()

	timeout := time.After(5 * time.Minute)

	// get the file from the workspace, if it exists
	files, err := workspace.ListFiles(ctx, w.ID, w.CurrentRevision, c.ID)
	if err != nil {
		return fmt.Errorf("failed to list files: %w", err)
	}

	var file *workspacetypes.File
	for _, f := range files {
		if f.FilePath == p.Path {
			file = &f
			break
		}
	}

	for {
		select {
		case <-timeout:
			return fmt.Errorf("timeout waiting for action execution")

		case err := <-errCh:
			if err != nil {
				return err
			}

		case interimContent := <-interimContentCh:
			if file == nil {
				// we need to create the file since we got content
				// we doin't do this early b/c sometimes the LLM will expect to
				// create the file but never put content in it
				err := workspace.AddFileToChart(ctx, c.ID, w.ID, w.CurrentRevision, p.Path, "")
				if err != nil {
					return fmt.Errorf("failed to add file to chart: %w", err)
				}

				files, err := workspace.ListFiles(ctx, w.ID, w.CurrentRevision, c.ID)
				if err != nil {
					return fmt.Errorf("failed to list files: %w", err)
				}

				for _, f := range files {
					if f.FilePath == p.Path {
						file = &f
						break
					}
				}
			}

			if file == nil {
				return fmt.Errorf("file not found in workspace")
			}

			file.ContentPending = &interimContent

			e := realtimetypes.ArtifactUpdatedEvent{
				WorkspaceID:   updatedPlan.WorkspaceID,
				WorkspaceFile: file,
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send artifact update: %w", err)
			}

		case finalContent := <-finalContentCh:
			if err := finalizeFile(ctx, finalContent, updatedPlan, p, w, c, realtimeRecipient); err != nil {
				return err
			}
			return nil
		}
	}
}

func finalizeFile(ctx context.Context, finalContent string, updatedPlan *workspacetypes.Plan, p executeActionPayload, w *workspacetypes.Workspace, c workspacetypes.Chart, realtimeRecipient realtimetypes.Recipient) error {
	// Create dedicated context with timeout for database operations
	dbCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := workspace.SetFileContentPending(dbCtx, p.Path, w.CurrentRevision, c.ID, w.ID, finalContent); err != nil {
		return fmt.Errorf("failed to set file content pending: %w", err)
	}

	// update the action file to completed
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	finalUpdateTx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer finalUpdateTx.Rollback(ctx)

	finalUpdatePlan, err := workspace.GetPlan(ctx, finalUpdateTx, updatedPlan.ID)
	if err != nil {
		return fmt.Errorf("failed to get plan: %w", err)
	}

	for i, item := range finalUpdatePlan.ActionFiles {
		if item.Path == p.Path {
			finalUpdatePlan.ActionFiles[i].Status = string(llmtypes.ActionPlanStatusCreated)
			break
		}
	}

	if err := workspace.UpdatePlanActionFiles(ctx, finalUpdateTx, finalUpdatePlan.ID, finalUpdatePlan.ActionFiles); err != nil {
		return fmt.Errorf("failed to update plan: %w", err)
	}

	if err := finalUpdateTx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	e := realtimetypes.PlanUpdatedEvent{
		WorkspaceID: updatedPlan.WorkspaceID,
		Plan:        updatedPlan,
	}

	// send the updated plan to the realtime server
	e.Plan = finalUpdatePlan
	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send plan update: %w", err)
	}

	if finalUpdatePlan.IsComplete {
		// check if there are any pending actions in the queue that are incomplete
		pendingActionPaths, err := workspace.PendingActionPathsForPlan(ctx, finalUpdatePlan.ID)
		if err != nil {
			return fmt.Errorf("failed to list pending actions: %w", err)
		}

		countOtherPaths := 0
		for _, pap := range pendingActionPaths {
			if pap != p.Path {
				countOtherPaths++
			}
		}

		if countOtherPaths == 0 {
			// send the plan status as complete to the realtime server
			e.Plan.Status = workspacetypes.PlanStatusApplied

			if err := workspace.UpdatePlanStatus(ctx, finalUpdatePlan.ID, workspacetypes.PlanStatusApplied); err != nil {
				return fmt.Errorf("failed to set plan status: %w", err)
			}

			// Mark the revision as complete
			if err := workspace.SetRevisionComplete(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision); err != nil {
				return fmt.Errorf("failed to mark revision as complete: %w", err)
			}

			if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
				return fmt.Errorf("failed to send plan update: %w", err)
			}

			// trigger embeddings for the files in this workspace
			if err := workspace.NotifyWorkerToCaptureEmbeddings(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision); err != nil {
				return fmt.Errorf("failed to notify worker to capture embeddings: %w", err)
			}

			// Get the LAST chat message associated with this plan
			// This ensures we're associating the render with the most recent message
			var chatMessageID string
			if len(finalUpdatePlan.ChatMessageIDs) > 0 {
				chatMessageID = finalUpdatePlan.ChatMessageIDs[len(finalUpdatePlan.ChatMessageIDs)-1]

				// Create a render job for the completed revision and associate it with the chat message
				if err := workspace.EnqueueRenderWorkspaceForRevisionWithPendingContent(ctx, finalUpdatePlan.WorkspaceID, w.CurrentRevision, chatMessageID); err != nil {
					return fmt.Errorf("failed to create render job for completed plan: %w", err)
				}
			} else {
				logger.Warn("No chat messages found for plan, skipping render association",
					zap.String("planID", finalUpdatePlan.ID))
			}
		}
	}

	return nil
}
