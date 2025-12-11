package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

// StartHTTPServer starts the HTTP server on the specified port.
// It registers all routes and handles graceful shutdown.
// CORS middleware to allow requests from frontend
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "3600")

		// Handle preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func StartHTTPServer(ctx context.Context, port int) error {
	mux := http.NewServeMux()
	RegisterRoutes(mux)

	// Wrap with CORS middleware
	handler := corsMiddleware(mux)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second, // Long timeout for streaming
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
		go func() {
		logger.Info("Starting HTTP server", zap.Int("port", port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error(err, zap.String("message", "HTTP server error"))
		}
	}()

	// Wait for context cancellation
	<-ctx.Done()
	logger.Info("Shutting down HTTP server")

	// Graceful shutdown with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("failed to shutdown HTTP server: %w", err)
	}

	return nil
}
