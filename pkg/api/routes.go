package api

import "net/http"

// RegisterRoutes registers all API routes with the given ServeMux.
// This function should be called when setting up the HTTP server.
func RegisterRoutes(mux *http.ServeMux) {
	// Prompt type classification endpoint
	mux.HandleFunc("/api/prompt-type", HandlePromptType)
	
	// Chat streaming endpoint (AI SDK protocol)
	mux.HandleFunc("/api/v1/chat/stream", HandleChatStream)
}
