package listener

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
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
        `, errorMsg, "new_summarize", id)

		if updateErr != nil {
			logger.Error(fmt.Errorf("failed to update notification status: %w", updateErr))
		}
	}()

	logger.Debug("Starting file notification handling", zap.String("id", id))
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

	if fileRevision.Summary != "" {
		logger.Debug("File already has summary, skipping",
			zap.String("file_id", fileID),
			zap.Int("revision", revisionNumber))
		return nil
	}

	logger.Debug("Getting summary for file",
		zap.String("file_id", fileID),
		zap.Int("revision", revisionNumber))
	summary, err := llm.SummarizeContent(ctx, fileRevision.Content)
	if err != nil {
		processingErr = fmt.Errorf("failed to summarize content: %w", err)
		return processingErr
	}

	logger.Debug("Getting embeddings for summary",
		zap.String("file_id", fileID),
		zap.Int("revision", revisionNumber))
	embeddings, err := embedding.Embeddings(summary)
	if err != nil {
		processingErr = fmt.Errorf("failed to get embeddings: %w", err)
		return processingErr
	}

	logger.Debug("Setting file summary and embeddings",
		zap.String("file_id", fileID),
		zap.Int("revision", revisionNumber))
	err = workspace.SetFileSummaryAndEmbeddings(ctx, fileID, revisionNumber, summary, embeddings)
	if err != nil {
		processingErr = fmt.Errorf("failed to set summary and embeddings: %w", err)
		return processingErr
	}

	logger.Debug("Successfully completed file notification handling",
		zap.String("file_id", fileID),
		zap.Int("revision", revisionNumber))
	return nil
}
