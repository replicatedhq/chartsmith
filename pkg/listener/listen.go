package listener

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

func Listen(ctx context.Context) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	channels := []string{"new_chat", "new_gvk", "new_revision"}
	for _, channel := range channels {
		_, err := conn.Exec(ctx, fmt.Sprintf("LISTEN %s", channel))
		if err != nil {
			return fmt.Errorf("failed to listen on channel %s: %w", channel, err)
		}
		fmt.Printf("Listening on channel: %s\n", channel)
	}

	for {
		fmt.Printf("Waiting for notification...\n")
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			return fmt.Errorf("waiting for notification: %w", err)
		}

		// Try to claim this notification for processing
		claimed, err := claimNotification(ctx, notification.Channel, notification.Payload)
		if err != nil {
			fmt.Printf("Error claiming notification: %v\n", err)
			continue
		}

		if !claimed {
			fmt.Printf("Notification already claimed by another process\n")
			continue
		}

		switch notification.Channel {
		case "new_gvk":
			fmt.Printf("New GVK notification received: %+v\n", notification)
			go func() {
				if err := handleGVKNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new GVK notification: %+v\n", err)
				}
			}()
		case "new_chat":
			fmt.Printf("New chat notification received: %+v\n", notification)
			go func() {
				if err := handleNewChatNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new chat notification: %+v\n", err)
				}
			}()
		case "new_revision":
			fmt.Printf("New revision notification received: %+v\n", notification)
			go func() {
				if err := handleNewRevisionNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new revision notification: %+v\n", err)
				}
			}()
		default:
			fmt.Printf("Unknown notification received: %+v\n", notification)
		}
	}
}

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

func handleGVKNotification(ctx context.Context, id string) error {
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
        `, errorMsg, "new_gvk", id)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new GVK notification: %s\n", id)

	gvk, err := workspace.GetGVK(ctx, id)
	if err != nil {
		processingErr = err
		return err
	}

	summary, err := llm.SummarizeGVK(ctx, gvk.Content)
	if err != nil {
		processingErr = err
		return err
	}

	gvk.Summary = &summary

	return nil
}

func handleNewChatNotification(ctx context.Context, chatID string) error {
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
        `, errorMsg, "new_chat", chatID)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new chat notification: %s\n", chatID)

	chatMessage, err := chat.GetChatMessage(ctx, chatID)
	if err != nil {
		return fmt.Errorf("error getting chat message: %w", err)
	}

	w, err := workspace.GetWorkspace(ctx, chatMessage.WorkspaceID)
	if err != nil {
		return fmt.Errorf("error getting workspace: %w", err)
	}

	if w.CurrentRevision == 0 {
		workspaceChatMessages, err := chat.ListChatMessagesForWorkspace(ctx, w.ID)
		if err != nil {
			return fmt.Errorf("error listing previous chat messages: %w", err)
		}

		// remove the chat message with ID == chatID from the list
		previousChatMessages := []chattypes.Chat{}
		for _, chat := range workspaceChatMessages {
			if chat.ID != chatID {
				previousChatMessages = append(previousChatMessages, chat)
			}
		}

		if len(previousChatMessages) > 0 {
			fmt.Printf("Handling clarification chat for new workspace %s\n", w.ID)
			if err := llm.ClarificationChat(ctx, w, previousChatMessages, chatMessage); err != nil {
				return fmt.Errorf("error creating new chart: %w", err)
			}
		} else {
			fmt.Printf("Handling first chat for workspace %s\n", w.ID)
			if err := llm.CreateNewChartFromMessage(ctx, w, chatMessage); err != nil {
				return fmt.Errorf("error creating new chart: %w", err)
			}
		}
	} else {
		fmt.Printf("Handling new chat for workspace %s\n", w.ID)

		workspaceChatMessages, err := chat.ListChatMessagesForWorkspaceSinceRevision(ctx, w.ID, w.CurrentRevision)
		if err != nil {
			return fmt.Errorf("error listing previous chat messages: %w", err)
		}

		if len(workspaceChatMessages) == 0 {
			return nil
		}

		// we want to include all chat messages since the last revision, but not this one
		previousChatMessages := []chattypes.Chat{}
		for _, chat := range workspaceChatMessages {
			if chat.ID != chatMessage.ID {
				previousChatMessages = append(previousChatMessages, chat)
			}
		}

		rev, err := workspace.GetRevision(ctx, w.ID, w.CurrentRevision)
		if err != nil {
			return fmt.Errorf("error getting revision: %w", err)
		}

		relevantGVKs, err := workspace.ChooseRelevantGVKsForChatMessage(ctx, w, rev.RevisionNumber, chatMessage)
		if err != nil {
			return fmt.Errorf("error choosing relevant GVKs: %w", err)
		}

		// get the files from the previous revision for those GVKs
		files, err := workspace.GetFilesForGVKs(ctx, w.ID, rev.RevisionNumber, relevantGVKs)
		if err != nil {
			return fmt.Errorf("error getting files for GVKs: %w", err)
		}

		if err := llm.IterationChat(ctx, w, previousChatMessages, chatMessage, files); err != nil {
			return fmt.Errorf("error creating new chart: %w", err)
		}
	}

	return nil
}

func claimNotification(ctx context.Context, notificationChannel string, notificationID string) (bool, error) {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var claimed bool
	err := conn.QueryRow(ctx, `
        INSERT INTO notification_processing (
			notification_channel,
            notification_id,
            claimed_at,
            claimed_by
        )
        VALUES ($1, $2, NOW(), pg_backend_pid())
        ON CONFLICT (notification_channel, notification_id) DO NOTHING
        RETURNING true
    `, notificationChannel, notificationID).Scan(&claimed)

	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
