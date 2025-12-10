package api

import "net/http"

// RegisterRoutes registers all API routes with the given ServeMux.
// This function should be called when setting up the HTTP server.
func RegisterRoutes(mux *http.ServeMux) {
	// Prompt type classification endpoint
	mux.HandleFunc("/api/prompt-type", HandlePromptType)
	
	// Note: Other routes (like /api/v1/chat/stream) should be registered here as well
	// when they are implemented.
}
