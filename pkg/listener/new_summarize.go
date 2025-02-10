package listener

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

type newSummarizePayload struct {
	FileID   string `json:"fileId"`
	Revision int    `json:"revision"`
}

func handleNewSummarizeNotification(ctx context.Context, payload string) error {
	logger.Info("New summarize notification received", zap.String("payload", payload))
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var p newSummarizePayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

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
        `, errorMsg, "new_summarize", p.FileID)

		if updateErr != nil {
			logger.Error(fmt.Errorf("failed to update notification status: %w", updateErr))
		}
	}()

	fileRevision, err := workspace.GetFile(ctx, p.FileID, p.Revision)
	if err != nil {
		processingErr = fmt.Errorf("failed to get file: %w", err)
		return processingErr
	}

	embeddings, err := embedding.Embeddings(fileRevision.Content)
	if err != nil {
		processingErr = fmt.Errorf("failed to get embeddings: %w", err)
		return processingErr
	}

	err = workspace.SetFileEmbeddings(ctx, p.FileID, p.Revision, embeddings)
	if err != nil {
		processingErr = fmt.Errorf("failed to set summary and embeddings: %w", err)
		return processingErr
	}
	return nil
}
