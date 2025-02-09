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
}

// NewListener creates a new Listener instance
func NewListener() *Listener {
	return &Listener{
		handlers:          make(map[string]NotificationHandler),
		reconnectInterval: 10 * time.Second,
		maxReconnectRetry: 10,
	}
}

// AddHandler registers a handler for a specific channel
func (l *Listener) AddHandler(channel string, handler NotificationHandler) {
	l.handlers[channel] = handler
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

// processNotifications handles incoming notifications
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

		// Look up the handler for this channel
		handler, exists := l.handlers[notification.Channel]
		if !exists {
			log.Printf("No handler registered for channel: %s", notification.Channel)
			continue
		}

		// Execute the handler
		if err := handler(notification); err != nil {
			log.Printf("Error handling notification on channel %s: %v", notification.Channel, err)
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
