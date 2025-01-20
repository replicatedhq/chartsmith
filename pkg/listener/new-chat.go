package listener

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/chat"
	chattypes "github.com/replicatedhq/chartsmith/pkg/chat/types"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
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

	// there are some shortcuts we take if there isn't a revision the user has accepted yet
	// because we are operating from the bootstrap workspace
	if w.CurrentRevision == 0 {
		if err := handleFirstRevisionChatMessage(ctx, w, chatMessage); err != nil {
			return fmt.Errorf("error handling first chat message: %w", err)
		}

		return nil
	}

	fmt.Printf("Handling new chat for workspace %s\n", w.ID)

	workspaceChatMessages, err := chat.ListChatMessagesForWorkspaceSinceRevision(ctx, w.ID, w.CurrentRevision)
	if err != nil {
		return fmt.Errorf("error listing previous chat messages: %w", err)
	}

	if len(workspaceChatMessages) == 0 {
		return nil
	}

	// we want to include all chat messages since the last revision, but not this one
	// also ignore ignored chat messages
	previousChatMessages := []chattypes.Chat{}
	for _, chat := range workspaceChatMessages {
		if chat.IsIgnored {
			continue
		}
		if chat.ID == chatMessage.ID {
			continue
		}

		previousChatMessages = append(previousChatMessages, chat)
	}

	currentRevision, err := workspace.GetRevision(ctx, w.ID, w.CurrentRevision)
	if err != nil {
		return fmt.Errorf("error getting revision: %w", err)
	}

	chartID := w.Charts[0].ID
	relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(ctx, w, chartID, currentRevision.RevisionNumber, chatMessage)
	if err != nil {
		return fmt.Errorf("error choosing relevant files: %w", err)
	}

	fmt.Printf("Relevant files (printing %d files):\n", len(relevantFiles))
	for _, file := range relevantFiles {
		fmt.Printf("  %s\n", file.FilePath)
	}

	if err := llm.IterationChat(ctx, w, previousChatMessages, chatMessage, relevantFiles); err != nil {
		return fmt.Errorf("error creating new chart: %w", err)
	}

	return nil
}

func handleFirstRevisionChatMessage(ctx context.Context, w *workspacetypes.Workspace, chatMessage *chattypes.Chat) error {
	workspaceChatMessages, err := chat.ListChatMessagesForWorkspace(ctx, w.ID)
	if err != nil {
		return fmt.Errorf("error listing previous chat messages: %w", err)
	}

	// remove the chat message with ID == chatID from the list
	// also remove ignored chat messages
	previousChatMessages := []chattypes.Chat{}
	for _, chat := range workspaceChatMessages {
		if chat.IsIgnored {
			continue
		}
		if chat.ID == chatMessage.ID {
			continue
		}

		previousChatMessages = append(previousChatMessages, chat)
	}

	if len(previousChatMessages) > 0 {
		fmt.Printf("Handling clarification chat for new workspace %s\n", w.ID)
		if err := llm.ClarificationChat(ctx, w, previousChatMessages, chatMessage); err != nil {
			return fmt.Errorf("error creating new chart: %w", err)
		}
	} else {
		fmt.Printf("Creating first user revision for workspace %s\n", w.ID)
		allChatMessages := append(previousChatMessages, *chatMessage)
		if err := llm.CreateFirstPlanFromChatMessages(ctx, w, allChatMessages); err != nil {
			return fmt.Errorf("error creating new chart: %w", err)
		}
	}

	return nil
}
