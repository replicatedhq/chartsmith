package persistence

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/replicatedhq/chartsmith/pkg/logger"
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

	pool, err = pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return fmt.Errorf("failed to create Postgres pool: %w", err)
	}

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

	// Log pool stats
	logger.Debug(fmt.Sprintf("Pool stats before acquire: Total=%d, Acquired=%d, Idle=%d, Max=%d", 
		pool.Stat().TotalConns(), 
		pool.Stat().AcquiredConns(),
		pool.Stat().IdleConns(),
		pool.Stat().MaxConns()))

	// Set a 5 second timeout for acquiring a connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	// Track timing for connection acquisition
	startTime := time.Now()
	logger.Debug("Getting pooled PostgreSQL connection")
	
	conn, err := pool.Acquire(ctx)
	if err != nil {
		logger.Error(fmt.Errorf("failed to acquire from Postgres pool: %w", err))
		panic("failed to acquire from Postgres pool: " + err.Error())
	}
	
	logger.Debug(fmt.Sprintf("Acquired PostgreSQL connection in %v", time.Since(startTime)))

	return conn
}
