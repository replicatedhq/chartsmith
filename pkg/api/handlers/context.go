// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"go.uber.org/zap"
)

// ChartContextRequest represents a request to get chart context
type ChartContextRequest struct {
	WorkspaceID    string `json:"workspaceId"`
	RevisionNumber int    `json:"revisionNumber"`
}

// ChartContextFile represents a file in the response
type ChartContextFile struct {
	ID             string  `json:"id"`
	FilePath       string  `json:"filePath"`
	Content        string  `json:"content"`
	ContentPending *string `json:"contentPending,omitempty"`
}

// ChartContextChart represents a chart in the response
type ChartContextChart struct {
	ID    string             `json:"id"`
	Name  string             `json:"name"`
	Files []ChartContextFile `json:"files"`
}

// ChartContextResponse represents the response for chart context lookup
type ChartContextResponse struct {
	Success  bool                `json:"success"`
	Message  string              `json:"message,omitempty"`
	Charts   []ChartContextChart `json:"charts,omitempty"`
	Revision int                 `json:"revisionNumber,omitempty"`
}

// GetChartContext handles requests to get the current chart context
// POST /api/tools/context
func GetChartContext(w http.ResponseWriter, r *http.Request) {
	var req ChartContextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Debug("Failed to decode chart context request", zap.Error(err))
		writeBadRequest(w, "Invalid request body")
		return
	}

	// Validate required fields
	if req.WorkspaceID == "" {
		writeBadRequest(w, "workspaceId is required")
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	logger.Debug("Getting chart context",
		zap.String("workspaceId", req.WorkspaceID),
		zap.Int("revisionNumber", req.RevisionNumber))

	// Get charts from workspace
	charts, err := workspace.ListCharts(ctx, req.WorkspaceID, req.RevisionNumber)
	if err != nil {
		logger.Debug("Failed to list charts", zap.Error(err))
		writeJSON(w, http.StatusOK, ChartContextResponse{
			Success: false,
			Message: "Failed to access workspace",
		})
		return
	}

	// Transform to response format
	responseCharts := make([]ChartContextChart, 0, len(charts))
	for _, chart := range charts {
		files := make([]ChartContextFile, 0, len(chart.Files))
		for _, file := range chart.Files {
			f := ChartContextFile{
				ID:       file.ID,
				FilePath: file.FilePath,
				Content:  file.Content,
			}
			if file.ContentPending != nil {
				f.ContentPending = file.ContentPending
			}
			files = append(files, f)
		}
		responseCharts = append(responseCharts, ChartContextChart{
			ID:    chart.ID,
			Name:  chart.Name,
			Files: files,
		})
	}

	writeJSON(w, http.StatusOK, ChartContextResponse{
		Success:  true,
		Charts:   responseCharts,
		Revision: req.RevisionNumber,
	})
}

