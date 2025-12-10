package api

import (
	"encoding/json"
	"net/http"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

// PromptTypeRequest represents the request body for prompt type classification.
type PromptTypeRequest struct {
	Message string `json:"message"`
}

// PromptTypeResponse represents the response from prompt type classification.
type PromptTypeResponse struct {
	Type string `json:"type"` // "plan" or "chat"
}

// HandlePromptType handles POST requests to /api/prompt-type.
// It classifies a user message as either "plan" or "chat" using the LLM.
func HandlePromptType(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req PromptTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		http.Error(w, "Message is required", http.StatusBadRequest)
		return
	}

	// Call LLM for classification
	promptType, err := llm.ClassifyPromptType(r.Context(), req.Message)
	if err != nil {
		logger.Error("Failed to classify prompt type", zap.Error(err))
		http.Error(w, "Failed to classify prompt type", http.StatusInternalServerError)
		return
	}

	response := PromptTypeResponse{Type: promptType}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		logger.Error("Failed to encode response", zap.Error(err))
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}
