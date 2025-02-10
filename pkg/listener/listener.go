package listener

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"go.uber.org/zap"
)

// NotificationHandler is a function type that handles notifications
type NotificationHandler func(notification *pgconn.Notification) error

// Listener manages PostgreSQL LISTEN/NOTIFY subscriptions
type Listener struct {
	conn              *pgx.Conn
	handlers          map[string]NotificationHandler
	reconnectInterval time.Duration
	maxReconnectRetry int
	processors        map[string]*queueProcessor
	pgURI             string // Store the connection string for pooled connections
}

const (
	WorkQueueTable = "work_queue"
)

type queueProcessor struct {
	channel     string
	handler     NotificationHandler
	workerPool  chan struct{}
	processing  bool
	pollTicker  *time.Ticker
	maxWorkers  int
	maxDuration time.Duration // Maximum time a task can be processing before considered failed
}

// NewListener creates a new Listener instance
func NewListener() *Listener {
	return &Listener{
		handlers:          make(map[string]NotificationHandler),
		reconnectInterval: 10 * time.Second,
		maxReconnectRetry: 10,
		processors:        make(map[string]*queueProcessor),
		pgURI:             param.Get().PGURI,
	}
}

// AddHandler registers a handler for a specific type of work
func (l *Listener) AddHandler(ctx context.Context, channel string, maxWorkers int, maxDuration time.Duration, handler NotificationHandler) error {
	l.handlers[channel] = handler

	// Initialize queue processor
	l.processors[channel] = &queueProcessor{
		channel:     channel,
		handler:     handler,
		workerPool:  make(chan struct{}, maxWorkers),
		pollTicker:  time.NewTicker(5 * time.Second),
		maxWorkers:  maxWorkers,
		maxDuration: maxDuration,
	}

	return nil
}

// Start begins listening for notifications
func (l *Listener) Start(ctx context.Context) error {
	var err error
	l.conn, err = pgx.Connect(ctx, param.Get().PGURI)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Listen on all channels that have registered handlers
	for channel := range l.handlers {
		if _, err := l.conn.Exec(ctx, fmt.Sprintf("LISTEN %s", channel)); err != nil {
			return fmt.Errorf("failed to listen on channel %s: %w", channel, err)
		}

		// Check for existing work in each queue
		processor := l.processors[channel]
		if !processor.processing {
			processor.processing = true
			go l.processQueue(ctx, processor)
		}
	}

	// Start processing notifications
	go l.processNotifications(ctx)

	return nil
}

// processNotifications now triggers message processing instead of directly handling
func (l *Listener) processNotifications(ctx context.Context) {
	for {
		notification, err := l.conn.WaitForNotification(ctx)
		if err != nil {
			if ctx.Err() != nil {
				// Context was canceled, exit gracefully
				return
			}
			logger.Error(fmt.Errorf("failed to wait for notification: %w", err))

			// Attempt to reconnect
			if err := l.reconnect(ctx); err != nil {
				logger.Error(fmt.Errorf("failed to reconnect: %w", err))
				return
			}
			continue
		}

		processor, exists := l.processors[notification.Channel]
		if !exists {
			logger.Warn("no processor registered for channel", zap.String("channel", notification.Channel))
			continue
		}

		// Trigger processing if not already processing
		if !processor.processing {
			processor.processing = true
			go l.processQueue(ctx, processor)
		}
	}
}

// processQueue handles message processing for a specific queue
func (l *Listener) processQueue(ctx context.Context, processor *queueProcessor) {
	defer func() { processor.processing = false }()

	for {
		select {
		case <-ctx.Done():
			return
		case <-processor.pollTicker.C:
			// Continue processing on ticker
		default:
			// Process immediately on notification
		}

		// Use a pooled connection for queue operations
		poolConn, err := pgx.Connect(ctx, l.pgURI)
		if err != nil {
			logger.Error(fmt.Errorf("failed to connect to database for queue processing: %w", err))
			return
		}
		defer poolConn.Close(ctx)

		// First get queue statistics
		var total, inFlight, available int
		err = poolConn.QueryRow(ctx, fmt.Sprintf(`
			SELECT
				COUNT(*) as total,
				COUNT(CASE WHEN processing_started_at IS NOT NULL AND completed_at IS NULL THEN 1 END) as in_flight,
				COUNT(CASE WHEN processing_started_at IS NULL AND completed_at IS NULL THEN 1 END) as available
			FROM %s
			WHERE channel = $1
			AND completed_at IS NULL`, WorkQueueTable), processor.channel).Scan(&total, &inFlight, &available)

		if err != nil {
			logger.Error(fmt.Errorf("failed to get queue statistics: %w", err))
		} else {
			logger.Info("queue status",
				zap.String("channel", processor.channel),
				zap.Int("total", total),
				zap.Int("in_flight", inFlight),
				zap.Int("available", available))
		}

		// Query and lock unprocessed messages atomically
		rows, err := poolConn.Query(ctx, fmt.Sprintf(`
			WITH next_available_messages AS (
				SELECT id, payload
				FROM %s
				WHERE completed_at IS NULL
				AND channel = $1
				AND (
					processing_started_at IS NULL
					OR processing_started_at < NOW() - $2::interval
				)
				ORDER BY created_at ASC
				LIMIT %d
				FOR UPDATE SKIP LOCKED
			)
			UPDATE %s AS wq
			SET processing_started_at = NOW(),
				attempt_count = COALESCE(attempt_count, 0) + CASE
					WHEN processing_started_at IS NOT NULL THEN 1
					ELSE 0
				END
			FROM next_available_messages
			WHERE wq.id = next_available_messages.id
			RETURNING wq.id, wq.payload, COALESCE(wq.attempt_count, 0)::int`,
			WorkQueueTable, processor.maxWorkers, WorkQueueTable),
			processor.channel, processor.maxDuration.String())

		if err != nil {
			logger.Error(fmt.Errorf("failed to query messages: %w", err))
			return
		}

		// Count how many messages we're about to process
		messages := make([]struct {
			id           string
			payload      []byte
			attemptCount int
		}, 0)

		for rows.Next() {
			var msg struct {
				id           string
				payload      []byte
				attemptCount int
			}
			if err := rows.Scan(&msg.id, &msg.payload, &msg.attemptCount); err != nil {
				logger.Error(fmt.Errorf("failed to scan message: %w", err))
				continue
			}
			messages = append(messages, msg)
		}
		rows.Close()

		if len(messages) > 0 {
			logger.Info("processing messages",
				zap.Int("count", len(messages)),
				zap.String("channel", processor.channel))
		}

		// Process the messages
		for _, msg := range messages {
			if msg.attemptCount > 0 {
				logger.Info("retrying message",
					zap.String("id", msg.id),
					zap.Int("attempt", msg.attemptCount),
					zap.Duration("timeout", processor.maxDuration))
			}

			// Wait for worker slot
			processor.workerPool <- struct{}{}

			go func(messageID string, messagePayload []byte) {
				defer func() { <-processor.workerPool }()

				startTime := time.Now()

				// Create notification with payload
				notification := &pgconn.Notification{
					Channel: processor.channel,
					Payload: string(messagePayload),
				}

				// Process message
				err := processor.handler(notification)

				// Use a new pooled connection for updating the message
				updateConn, err := pgx.Connect(ctx, l.pgURI)
				if err != nil {
					logger.Error(fmt.Errorf("failed to connect to database for message update: %w", err))
					return
				}
				defer updateConn.Close(ctx)

				if err != nil {
					// If processing failed, mark it as available for retry
					_, updateErr := updateConn.Exec(ctx, fmt.Sprintf(`
						UPDATE %s
						SET processing_started_at = NULL,
							last_error = $2,
							attempt_count = attempt_count + 1
						WHERE id = $1`, WorkQueueTable),
						messageID, err.Error())
					if updateErr != nil {
						logger.Error(fmt.Errorf("failed to mark message %s as failed: %w", messageID, updateErr))
					}
					return
				}

				// Mark as completed
				_, err = updateConn.Exec(ctx, fmt.Sprintf(`
					UPDATE %s
					SET completed_at = NOW()
					WHERE id = $1`, WorkQueueTable), messageID)
				if err != nil {
					logger.Error(fmt.Errorf("failed to mark message %s as completed: %w", messageID, err))
					return
				}

				// Log successful completion with duration
				logger.Info("message processed",
					zap.String("id", messageID),
					zap.String("channel", processor.channel),
					zap.Duration("duration", time.Since(startTime)))

			}(msg.id, msg.payload)
		}

		// If no messages found, stop processing until next notification
		if len(messages) == 0 {
			return
		}
	}
}

// reconnect attempts to reestablish the database connection
func (l *Listener) reconnect(ctx context.Context) error {
	var err error
	for i := 0; i < l.maxReconnectRetry; i++ {
		if l.conn != nil {
			l.conn.Close(ctx)
		}

		l.conn, err = pgx.Connect(ctx, param.Get().PGURI)
		if err == nil {
			// Resubscribe to all channels
			for channel := range l.handlers {
				if _, err := l.conn.Exec(ctx, fmt.Sprintf("LISTEN %s", channel)); err != nil {
					return fmt.Errorf("failed to relisten on channel %s: %w", channel, err)
				}
			}
			return nil
		}

		time.Sleep(l.reconnectInterval)
	}
	return fmt.Errorf("failed to reconnect after %d attempts", l.maxReconnectRetry)
}

// Stop gracefully shuts down the listener
func (l *Listener) Stop(ctx context.Context) error {
	if l.conn != nil {
		return l.conn.Close(ctx)
	}
	return nil
}
