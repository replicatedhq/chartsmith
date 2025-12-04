// Package api provides HTTP server functionality for AI SDK tool execution.
package api

import (
	"context"
	"net/http"

	"github.com/replicatedhq/chartsmith/pkg/api/handlers"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

// StartHTTPServer starts the HTTP server for tool execution endpoints.
// It runs on the specified port and blocks until the context is cancelled.
func StartHTTPServer(ctx context.Context, port string) error {
	mux := http.NewServeMux()
	
	// Register tool endpoints
	// These endpoints are called by AI SDK tools running in Next.js
	mux.HandleFunc("POST /api/tools/editor", handlers.TextEditor)
	mux.HandleFunc("POST /api/tools/versions/subchart", handlers.GetSubchartVersion)
	mux.HandleFunc("POST /api/tools/versions/kubernetes", handlers.GetKubernetesVersion)
	mux.HandleFunc("POST /api/tools/context", handlers.GetChartContext)
	
	// Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"status":  "healthy",
		})
	})
	
	server := &http.Server{
		Addr:    ":" + port,
		Handler: loggingMiddleware(mux),
	}
	
	// Handle graceful shutdown
	go func() {
		<-ctx.Done()
		logger.Info("Shutting down HTTP server...")
		server.Shutdown(context.Background())
	}()
	
	logger.Info("HTTP server listening", zap.String("port", port))
	return server.ListenAndServe()
}

// loggingMiddleware logs incoming HTTP requests
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.Debug("HTTP request",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("remote_addr", r.RemoteAddr))
		next.ServeHTTP(w, r)
	})
}

