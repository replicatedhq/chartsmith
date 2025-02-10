package persistence

import (
	"context"
	"fmt"

	"github.com/tuvistavie/securerandom"
)

func EnqueueWork(ctx context.Context, channel string, payload interface{}) error {
	conn := MustGetPooledPostgresSession()
	defer conn.Release()

	id, err := securerandom.Hex(6)
	if err != nil {
		return fmt.Errorf("failed to generate id: %w", err)
	}

	_, err = conn.Exec(ctx, `INSERT INTO work_queue (id, channel, payload, created_at) VALUES ($1, $2, $3, NOW())`, id, channel, payload)
	if err != nil {
		return fmt.Errorf("failed to insert work: %w", err)
	}

	_, err = conn.Exec(ctx, `SELECT pg_notify($1, $2)`, channel, id)
	if err != nil {
		return fmt.Errorf("failed to notify: %w", err)
	}

	return nil
}
