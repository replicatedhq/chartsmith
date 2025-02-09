package listener

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
)

func HandleNewFileNotification(ctx context.Context, id string) error {
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
        `, errorMsg, "new_summarize", id)

		if updateErr != nil {
			logger.Error(fmt.Errorf("failed to update notification status: %w", updateErr))
		}
	}()

	parts := strings.Split(id, "/")
	fileID := parts[0]
	revisionNumber, err := strconv.Atoi(parts[1])
	if err != nil {
		processingErr = fmt.Errorf("failed to parse revision number: %w", err)
		return processingErr
	}

	fileRevision, err := workspace.GetFile(ctx, fileID, revisionNumber)
	if err != nil {
		processingErr = fmt.Errorf("failed to get file: %w", err)
		return processingErr
	}

	embeddings, err := embedding.Embeddings(fileRevision.Content)
	if err != nil {
		processingErr = fmt.Errorf("failed to get embeddings: %w", err)
		return processingErr
	}

	err = workspace.SetFileEmbeddings(ctx, fileID, revisionNumber, embeddings)
	if err != nil {
		processingErr = fmt.Errorf("failed to set summary and embeddings: %w", err)
		return processingErr
	}
	return nil
}
