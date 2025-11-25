package workspace

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"slices"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type RelevantFile struct {
	File       types.File
	Similarity float64
}

type WorkspaceFilter struct {
	ChartID *string
}

func ChooseRelevantFilesForChatMessage(
	ctx context.Context,
	w *types.Workspace,
	filter WorkspaceFilter,
	revisionNumber int,
	expandedPrompt string,
) ([]RelevantFile, error) {
	logger.Debug("Choosing relevant files for chat message",
		zap.String("workspace_id", w.ID),
		zap.Any("filter", filter),
		zap.Int("revision_number", revisionNumber),
		zap.Int("expanded_prompt_len", len(expandedPrompt)),
	)

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()
	fileMap := make(map[string]struct {
		file       types.File
		similarity float64
	})

	// Helper to add files to map
	addFile := func(file types.File, similarity float64) {
		fileMap[file.ID] = struct {
			file       types.File
			similarity float64
		}{
			file:       file,
			similarity: similarity,
		}
	}

	// Try to get embeddings, but fallback if it fails
	promptEmbeddings, err := embedding.Embeddings(expandedPrompt)
	if err != nil {
		logger.Warn("Failed to get embeddings, falling back to listing all files", zap.Error(err))

		// Fallback: Get all files for this revision
		query := `
			SELECT 
				id, 
				revision_number, 
				chart_id, 
				workspace_id, 
				file_path, 
				content 
			FROM workspace_file 
			WHERE workspace_id = $1 AND revision_number = $2`

		rows, err := conn.Query(ctx, query, w.ID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error listing files: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var file types.File
			var chartID sql.NullString
			err := rows.Scan(
				&file.ID,
				&file.RevisionNumber,
				&chartID,
				&file.WorkspaceID,
				&file.FilePath,
				&file.Content,
			)
			if err != nil {
				return nil, fmt.Errorf("error scanning file: %w", err)
			}
			file.ChartID = chartID.String

			// Assign arbitrary high similarity since we can't calculate it
			similarity := 0.5
			if file.FilePath == "Chart.yaml" || file.FilePath == "values.yaml" {
				similarity = 1.0
			}

			addFile(file, similarity)
		}
	} else {
		// Happy path with embeddings

		// get the chart.yaml
		query := `SELECT id, revision_number, chart_id, workspace_id, file_path, content FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND file_path = 'Chart.yaml'`
		row := conn.QueryRow(ctx, query, w.ID, revisionNumber)
		var chartYAML types.File
		err = row.Scan(&chartYAML.ID, &chartYAML.RevisionNumber, &chartYAML.ChartID, &chartYAML.WorkspaceID, &chartYAML.FilePath, &chartYAML.Content)
		if err != nil && err != pgx.ErrNoRows {
			return nil, fmt.Errorf("error scanning chart.yaml: %w", err)
		} else if err == nil {
			addFile(chartYAML, 1.0)
		}

		// get the values.yaml
		query = `SELECT id, revision_number, chart_id, workspace_id, file_path, content FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND file_path = 'values.yaml'`
		row = conn.QueryRow(ctx, query, w.ID, revisionNumber)
		var valuesYAML types.File
		err = row.Scan(&valuesYAML.ID, &valuesYAML.RevisionNumber, &valuesYAML.ChartID, &valuesYAML.WorkspaceID, &valuesYAML.FilePath, &valuesYAML.Content)
		if err != nil && err != pgx.ErrNoRows {
			return nil, fmt.Errorf("error scanning values.yaml: %w", err)
		} else if err == nil {
			addFile(valuesYAML, 1.0)
		}

		// Query files with embeddings and calculate cosine similarity
		query = `
			WITH similarities AS (
				SELECT
					id,
					revision_number,
					chart_id,
					workspace_id,
					file_path,
					content,
					embeddings,
					1 - (embeddings <=> $1) as similarity
				FROM workspace_file
				WHERE workspace_id = $2
				AND revision_number = $3
				AND embeddings IS NOT NULL
			)
			SELECT
				id,
				revision_number,
				chart_id,
				workspace_id,
				file_path,
				content,
				similarity
			FROM similarities
			ORDER BY similarity DESC
		`

		rows, err := conn.Query(ctx, query, promptEmbeddings, w.ID, revisionNumber)
		if err != nil {
			return nil, fmt.Errorf("error querying relevant files: %w", err)
		}
		defer rows.Close()

		extensionsWithHighSimilarity := []string{".yaml", ".yml", ".tpl"}
		for rows.Next() {
			var file types.File
			var similarity float64
			var chartID sql.NullString
			err := rows.Scan(
				&file.ID,
				&file.RevisionNumber,
				&chartID,
				&file.WorkspaceID,
				&file.FilePath,
				&file.Content,
				&similarity,
			)
			if err != nil {
				return nil, fmt.Errorf("error scanning file: %w", err)
			}

			file.ChartID = chartID.String

			if !slices.Contains(extensionsWithHighSimilarity, filepath.Ext(file.FilePath)) {
				similarity = similarity - 0.25
			}

			if file.FilePath == "Chart.yaml" || file.FilePath == "values.yaml" {
				similarity = 1.0
			}

			addFile(file, similarity)
		}
	}

	sorted := make([]RelevantFile, 0, len(fileMap))
	for _, item := range fileMap {
		sorted = append(sorted, RelevantFile{
			File:       item.file,
			Similarity: item.similarity,
		})
	}

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Similarity > sorted[j].Similarity
	})

	return sorted, nil
}
