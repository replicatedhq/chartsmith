package persistence

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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
		return fmt.Errorf("Postgres URI is required")
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

func MustGeUunpooledPostgresSession() *pgx.Conn {
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
		panic("Postgres pool is not initialized")
	}

	conn, err := pool.Acquire(context.Background())
	if err != nil {
		panic("failed to acquire from Postgres pool: " + err.Error())
	}

	return conn
}
