package persistence

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"go.uber.org/zap"
)

type PostgresOpts struct {
	URI string
}

var (
	connStr string
	pool    *pgxpool.Pool
)

func InitPostgres(opts PostgresOpts) error {
	if opts.URI == "" {
		return errors.New("Postgres URI is required")
	}

	conn, err := pgx.Connect(context.Background(), opts.URI)
	if err != nil {
		return fmt.Errorf("failed to connect to Postgres: %w", err)
	}
	defer conn.Close(context.Background())
	connStr = opts.URI

	poolConfig, err := pgxpool.ParseConfig(opts.URI)
	if err != nil {
		return fmt.Errorf("failed to parse Postgres URI: %w", err)
	}
	
	// Increase max connections in the pool
	poolConfig.MaxConns = 30
	// Set reasonable connection lifetime to prevent stale connections
	poolConfig.MaxConnLifetime = 30 * time.Minute
	// Set reasonable idle timeout
	poolConfig.MaxConnIdleTime = 15 * time.Minute
	// Set health check interval
	poolConfig.HealthCheckPeriod = 1 * time.Minute
	
	logger.Info("Initializing database connection pool", 
		zap.Int32("MaxConns", poolConfig.MaxConns),
		zap.Duration("MaxConnLifetime", poolConfig.MaxConnLifetime),
		zap.Duration("MaxConnIdleTime", poolConfig.MaxConnIdleTime))

	pool, err = pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return fmt.Errorf("failed to create Postgres pool: %w", err)
	}
	
	// Start a background goroutine to monitor pool health and log stats periodically
	go monitorPoolHealth()

	return nil
}

func MustGeUnpooledPostgresSession() *pgx.Conn {
	if connStr == "" {
		panic("Postgres is not initialized")
	}

	conn, err := pgx.Connect(context.Background(), connStr)
	if err != nil {
		panic("failed to connect to Postgres: " + err.Error())
	}

	return conn
}

func MustGetPooledPostgresSession() *pgxpool.Conn {
	if pool == nil {
		logger.Error(fmt.Errorf("Postgres pool is not initialized"))
		panic("Postgres pool is not initialized")
	}

	// Only log pool stats if pool is getting full
	if pool.Stat().AcquiredConns() >= pool.Stat().MaxConns()*70/100 {
		logger.Debug("Pool stats before acquire",
			zap.Int32("TotalConns", pool.Stat().TotalConns()),
			zap.Int32("AcquiredConns", pool.Stat().AcquiredConns()),
			zap.Int32("IdleConns", pool.Stat().IdleConns()),
			zap.Int32("MaxConns", pool.Stat().MaxConns()))
	}
	
	// If the pool is saturated, log a warning
	if pool.Stat().AcquiredConns() >= pool.Stat().MaxConns() {
		logger.Warn("WARNING: Connection pool saturated",
			zap.Int32("AcquiredConns", pool.Stat().AcquiredConns()),
			zap.Int32("MaxConns", pool.Stat().MaxConns()),
			zap.Float64("UsagePercent", float64(pool.Stat().AcquiredConns())/float64(pool.Stat().MaxConns())*100))
	}

	// Track timing for connection acquisition
	startTime := time.Now()
	
	// Try 3 times to get a connection with increasing timeouts
	var conn *pgxpool.Conn
	var err error
	
	for attempt := 1; attempt <= 3; attempt++ {
		// Increase timeout with each attempt
		timeout := time.Duration(attempt) * 5 * time.Second
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		
		conn, err = pool.Acquire(ctx)
		cancel() // Cancel the context immediately after the acquire attempt
		
		if err == nil {
			// Only log if acquisition was slow
			duration := time.Since(startTime)
			if duration > 100*time.Millisecond {
				logger.Debug("Slow DB connection acquisition", 
					zap.String("duration", duration.String()),
					zap.Int("attempt", attempt))
			}
			return conn
		}
		
		logger.Warn("Failed to acquire DB connection", 
			zap.Int("attempt", attempt),
			zap.Int("maxAttempts", 3),
			zap.Error(err))
			
		// Only log pool stats on failure
		logger.Warn("Pool stats after failed acquisition attempt",
			zap.Int32("TotalConns", pool.Stat().TotalConns()),
			zap.Int32("AcquiredConns", pool.Stat().AcquiredConns()),
			zap.Int32("IdleConns", pool.Stat().IdleConns()),
			zap.Int32("MaxConns", pool.Stat().MaxConns()))
			
		// Wait a short time before retrying to give connections a chance to be released
		time.Sleep(time.Duration(attempt*100) * time.Millisecond)
	}
	
	// All attempts failed
	logger.Error(fmt.Errorf("failed to acquire from Postgres pool after 3 attempts: %w", err))
	panic("failed to acquire from Postgres pool: " + err.Error())
}

// monitorPoolHealth periodically checks the database connection pool health
// and logs statistics to help identify connection issues
func monitorPoolHealth() {
	// Check every 30 seconds
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		<-ticker.C
		
		if pool == nil {
			logger.Warn("Cannot monitor pool health: pool is nil")
			continue
		}
		
		stats := pool.Stat()
		
		// Only log if pool usage is significant
		if stats.AcquiredConns() > stats.MaxConns()*20/100 {
			logger.Info("DB Pool Health", 
				zap.Int32("Total", stats.TotalConns()),
				zap.Int32("Acquired", stats.AcquiredConns()),
				zap.Int32("Idle", stats.IdleConns()),
				zap.Int32("Max", stats.MaxConns()))
		}
		
		// Check if the pool is approaching saturation
		if stats.AcquiredConns() > stats.MaxConns()*80/100 {
			logger.Warn("DB Pool nearing saturation",
				zap.Int32("AcquiredConns", stats.AcquiredConns()),
				zap.Int32("MaxConns", stats.MaxConns()),
				zap.Float64("UsagePercent", float64(stats.AcquiredConns())/float64(stats.MaxConns())*100))
		}
		
		// Test a connection to make sure the pool is working properly
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		
		// Try to acquire a connection
		conn, err := pool.Acquire(ctx)
		if err != nil {
			logger.Error(fmt.Errorf("health check failed to acquire connection: %w", err))
			cancel()
			continue
		}
		
		// Run a simple query to verify the connection is working
		var result int
		err = conn.QueryRow(ctx, "SELECT 1").Scan(&result)
		
		// Always release the connection
		conn.Release()
		cancel()
		
		if err != nil {
			logger.Error(fmt.Errorf("health check query failed: %w", err))
		} else if result != 1 {
			logger.Error(fmt.Errorf("health check returned unexpected result: %d", result))
		}
		// Removed the "DB health check: connection test passed" message to reduce noise
	}
}