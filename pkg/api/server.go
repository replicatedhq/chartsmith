package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

// getAllowedOrigins returns the list of allowed CORS origins.
// In production, this should be configured via CORS_ALLOWED_ORIGINS env var.
// In development, it defaults to allowing localhost origins.
func getAllowedOrigins() []string {
	if origins := os.Getenv("CORS_ALLOWED_ORIGINS"); origins != "" {
		return strings.Split(origins, ",")
	}
	// Default for local development
	return []string{
		"http://localhost:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3000",
		"http://127.0.0.1:3001",
	}
}

// isOriginAllowed checks if the given origin is in the allowed list.
func isOriginAllowed(origin string, allowedOrigins []string) bool {
	for _, allowed := range allowedOrigins {
		if strings.TrimSpace(allowed) == origin {
			return true
		}
	}
	return false
}

// StartHTTPServer starts the HTTP server on the specified port.
// It registers all routes and handles graceful shutdown.

// corsMiddleware handles CORS for requests from the frontend.
// In production, only origins specified in CORS_ALLOWED_ORIGINS are allowed.
// In development, localhost origins are allowed by default.
func corsMiddleware(next http.Handler) http.Handler {
	allowedOrigins := getAllowedOrigins()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Only set CORS headers if origin is allowed
		if origin != "" && isOriginAllowed(origin, allowedOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "3600")
			w.Header().Set("Vary", "Origin")
		}

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
