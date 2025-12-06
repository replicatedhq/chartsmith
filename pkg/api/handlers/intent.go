// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

// ClassifyIntentRequest represents a request to classify user intent
type ClassifyIntentRequest struct {
	Prompt             string `json:"prompt"`
	IsInitialPrompt    bool   `json:"isInitialPrompt"`
	MessageFromPersona string `json:"messageFromPersona"`
}

// ClassifyIntentResponse represents the intent classification result
type ClassifyIntentResponse struct {
	Intent *workspacetypes.Intent `json:"intent"`
}

// ClassifyIntent handles intent classification via Groq LLM
// POST /api/intent/classify
func ClassifyIntent(w http.ResponseWriter, r *http.Request) {
	var req ClassifyIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Debug("Failed to decode classify intent request", zap.Error(err))
		writeBadRequest(w, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Prompt == "" {
		writeBadRequest(w, "prompt is required")
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	logger.Debug("ClassifyIntent request",
		zap.String("prompt", req.Prompt),
		zap.Bool("isInitialPrompt", req.IsInitialPrompt),
		zap.String("messageFromPersona", req.MessageFromPersona))

	// Convert persona string to enum pointer
	var persona *workspacetypes.ChatMessageFromPersona
	switch req.MessageFromPersona {
	case "developer":
		p := workspacetypes.ChatMessageFromPersonaDeveloper
		persona = &p
	case "operator":
		p := workspacetypes.ChatMessageFromPersonaOperator
		persona = &p
	case "auto", "":
		p := workspacetypes.ChatMessageFromPersonaAuto
		persona = &p
	default:
		p := workspacetypes.ChatMessageFromPersonaAuto
		persona = &p
	}

	// Call existing intent classification logic
	intent, err := llm.GetChatMessageIntent(ctx, req.Prompt, req.IsInitialPrompt, persona)
	if err != nil {
		logger.Errorf("Failed to classify intent: %v", err)
		writeInternalError(w, "Failed to classify intent: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, ClassifyIntentResponse{
		Intent: intent,
	})
}

