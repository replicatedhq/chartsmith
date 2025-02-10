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

	fileRevision, err := workspace.GetFile(ctx, p.FileID, p.Revision)
	if err != nil {
		return fmt.Errorf("failed to get file: %w", err)
	}

	embeddings, err := embedding.Embeddings(fileRevision.Content)
	if err != nil {
		return fmt.Errorf("failed to get embeddings: %w", err)
	}

	err = workspace.SetFileEmbeddings(ctx, p.FileID, p.Revision, embeddings)
	if err != nil {
		return fmt.Errorf("failed to set summary and embeddings: %w", err)
	}
	return nil
}
