package listener

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/replicatedhq/chartsmith/pkg/param"
)

// NotificationHandler is a function type that handles notifications
type NotificationHandler func(notification *pgconn.Notification) error

// Listener manages PostgreSQL LISTEN/NOTIFY subscriptions
type Listener struct {
	conn              *pgx.Conn
	handlers          map[string]NotificationHandler
	reconnectInterval time.Duration
	maxReconnectRetry int
	maxWorkers        int // Maximum concurrent workers per queue
	processors        map[string]*queueProcessor
	pgURI             string // Store the connection string for pooled connections
}

type queueProcessor struct {
	channel        string
	handler        NotificationHandler
	workerPool     chan struct{}
	processing     bool
	pollTicker     *time.Ticker
	queueTableName string
}

// NewListener creates a new Listener instance
func NewListener(maxWorkers int) *Listener {
	return &Listener{
		handlers:          make(map[string]NotificationHandler),
		reconnectInterval: 10 * time.Second,
		maxReconnectRetry: 10,
		maxWorkers:        maxWorkers,
		processors:        make(map[string]*queueProcessor),
		pgURI:             param.Get().PGURI,
	}
}

// AddHandler registers a handler and creates necessary table for the queue
func (l *Listener) AddHandler(ctx context.Context, channel string, queueTableName string, handler NotificationHandler) error {
	l.handlers[channel] = handler

	// Initialize queue processor
	l.processors[channel] = &queueProcessor{
		channel:        channel,
		handler:        handler,
		workerPool:     make(chan struct{}, l.maxWorkers),
		pollTicker:     time.NewTicker(5 * time.Second), // Poll every 5 seconds
		queueTableName: queueTableName,
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
			log.Printf("Error waiting for notification: %v", err)

			// Attempt to reconnect
			if err := l.reconnect(ctx); err != nil {
				log.Printf("Failed to reconnect: %v", err)
				return
			}
			continue
		}

		processor, exists := l.processors[notification.Channel]
		if !exists {
			log.Printf("No processor registered for channel: %s", notification.Channel)
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
			log.Printf("Error connecting to database for queue processing: %v", err)
			return
		}
		defer poolConn.Close(ctx)

		// Query for unprocessed messages
		rows, err := poolConn.Query(ctx, fmt.Sprintf(`
			SELECT id, payload FROM %s
			WHERE completed_at IS NULL
			ORDER BY created_at ASC
			LIMIT %d`, processor.queueTableName, l.maxWorkers))
		if err != nil {
			log.Printf("Error querying messages: %v", err)
			return
		}

		hasMessages := false
		for rows.Next() {
			hasMessages = true
			var id int64
			var payload []byte
			if err := rows.Scan(&id, &payload); err != nil {
				log.Printf("Error scanning message: %v", err)
				continue
			}

			// Wait for worker slot
			processor.workerPool <- struct{}{}

			go func(messageID int64, messagePayload []byte) {
				defer func() { <-processor.workerPool }()

				// Create notification with payload
				notification := &pgconn.Notification{
					Channel: processor.channel,
					Payload: string(messagePayload),
				}

				// Process message
				if err := processor.handler(notification); err != nil {
					log.Printf("Error processing message %d: %v", messageID, err)
					return
				}

				// Use a new pooled connection for updating the message
				updateConn, err := pgx.Connect(ctx, l.pgURI)
				if err != nil {
					log.Printf("Error connecting to database for message update: %v", err)
					return
				}
				defer updateConn.Close(ctx)

				// Mark as completed
				_, err = updateConn.Exec(ctx, fmt.Sprintf(`
					UPDATE %s
					SET completed_at = NOW()
					WHERE id = $1`, processor.queueTableName), messageID)
				if err != nil {
					log.Printf("Error marking message %d as completed: %v", messageID, err)
				}
			}(id, payload)
		}
		rows.Close()

		// If no messages found, stop processing until next notification
		if !hasMessages {
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
