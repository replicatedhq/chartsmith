package listener

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	"go.uber.org/zap"
)

var (
	heartbeatOnce sync.Once
	heartbeatDone chan struct{}
)

// StartHeartbeat initiates a goroutine that periodically pings database connections
// to prevent them from becoming stale during idle periods
func StartHeartbeat(ctx context.Context) {
	heartbeatOnce.Do(func() {
		// Create a buffered channel to avoid leaking goroutines
		heartbeatDone = make(chan struct{})

		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case <-ticker.C:
					// Perform health check
					if err := ensureActiveConnection(ctx); err != nil {
						logger.Warn("Connection heartbeat check failed", zap.Error(err))
					}

					// Also check if the realtime system is functioning
					if err := realtime.Ping(ctx); err != nil {
						logger.Warn("Realtime system heartbeat check failed", zap.Error(err))
					}

				case <-ctx.Done():
					logger.Info("Stopping connection heartbeat due to context cancellation")
					close(heartbeatDone)
					return

				case <-heartbeatDone:
					logger.Info("Stopping connection heartbeat")
					return
				}
			}
		}()

		logger.Info("Started connection heartbeat")
	})
}

// ensureActiveConnection verifies that our database connection is active
// and reestablishes it if necessary
func ensureActiveConnection(ctx context.Context) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Simple ping query to check the connection
	var result int
	err := conn.QueryRow(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		return fmt.Errorf("connection check failed: %w", err)
	}

	return nil
}
