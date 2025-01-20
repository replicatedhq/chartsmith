package listener

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

func handleNewFileNotification(ctx context.Context, id string) error {
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
        `, errorMsg, "new_file", id)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new file notification: %s\n", id)
	parts := strings.Split(id, "/")
	fileID := parts[0]
	revisionNumber, err := strconv.Atoi(parts[1])
	if err != nil {
		processingErr = err
		return err
	}

	fileRevision, err := workspace.GetFile(ctx, fileID, revisionNumber)
	if err != nil {
		processingErr = err
		return err
	}

	if fileRevision.Summary != "" {
		return nil
	}

	summary, err := llm.SummarizeGVK(ctx, fileRevision.Content)
	if err != nil {
		processingErr = err
		return err
	}

	embeddings, err := embedding.Embeddings(summary)
	if err != nil {
		processingErr = err
		return err
	}

	err = workspace.SetFileSummaryAndEmbeddings(ctx, fileID, revisionNumber, summary, embeddings)
	if err != nil {
		processingErr = err
		return err
	}

	return nil
}
