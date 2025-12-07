// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/validation"
	"go.uber.org/zap"
)

// ValidateChartRequest represents the request body for chart validation.
type ValidateChartRequest struct {
	WorkspaceID    string                 `json:"workspaceId"`
	RevisionNumber int                    `json:"revisionNumber"`
	Values         map[string]interface{} `json:"values,omitempty"`
	StrictMode     bool                   `json:"strictMode,omitempty"`
	KubeVersion    string                 `json:"kubeVersion,omitempty"`
}

// ValidateChart handles POST /api/validate
// Runs the validation pipeline (helm lint, helm template, kube-score)
// and returns the aggregated results.
func ValidateChart(w http.ResponseWriter, r *http.Request) {
	var req ValidateChartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Debug("Failed to decode validate request", zap.Error(err))
		writeBadRequest(w, "Invalid request body")
		return
	}

	// Validate required fields
	if req.WorkspaceID == "" {
		writeBadRequest(w, "workspaceId is required")
		return
	}
	if req.RevisionNumber < 0 {
		writeBadRequest(w, "revisionNumber must be non-negative")
		return
	}

	logger.Debug("Validate chart request",
		zap.String("workspaceId", req.WorkspaceID),
		zap.Int("revisionNumber", req.RevisionNumber),
		zap.Bool("strictMode", req.StrictMode),
		zap.String("kubeVersion", req.KubeVersion))

	// Create context with 30-second timeout
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Build validation request
	validationReq := validation.ValidationRequest{
		WorkspaceID:    req.WorkspaceID,
		RevisionNumber: req.RevisionNumber,
		Values:         req.Values,
		StrictMode:     req.StrictMode,
		KubeVersion:    req.KubeVersion,
	}

	// Run the validation pipeline
	result, err := validation.RunValidation(ctx, validationReq)
	if err != nil {
		logger.Error(err,
			zap.String("workspaceId", req.WorkspaceID))

		// Check for context timeout
		if ctx.Err() == context.DeadlineExceeded {
			writeError(w, http.StatusGatewayTimeout, "TIMEOUT", "Validation timed out after 30 seconds")
			return
		}

		writeInternalError(w, err.Error())
		return
	}

	// Return the validation result
	writeJSON(w, http.StatusOK, validation.ValidationResponse{
		Validation: result,
	})
}
