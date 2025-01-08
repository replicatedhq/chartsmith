package listener

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

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
