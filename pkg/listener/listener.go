package listener

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"go.uber.org/zap"
)

// NotificationHandler is a function type that handles notifications
type NotificationHandler func(notification *pgconn.Notification) error

// LockKeyExtractor is a function type that extracts the lock key from the payload
type LockKeyExtractor func(payload []byte) (string, error)

// Listener manages PostgreSQL LISTEN/NOTIFY subscriptions
type Listener struct {
	conn              *pgx.Conn
	handlers          map[string]NotificationHandler
	reconnectInterval time.Duration
	maxReconnectRetry int
	processors        map[string]*queueProcessor
	pgURI             string // Store the connection string for pooled connections
	queueLocks        map[string]map[string]chan struct{}
	mu                sync.Mutex
}

const (
	WorkQueueTable = "work_queue"
)

type queueProcessor struct {
	channel          string
	handler          NotificationHandler
	workerPool       chan struct{}
	processing       bool
	pollTicker       *time.Ticker
	maxWorkers       int
	maxDuration      time.Duration // Maximum time a task can be processing before considered failed
	lockKeyExtractor LockKeyExtractor
}

// NewListener creates a new Listener instance
func NewListener() *Listener {
	return &Listener{
		handlers:          make(map[string]NotificationHandler),
		reconnectInterval: 5 * time.Second,  // Start with a shorter interval
		maxReconnectRetry: 0,                // 0 means unlimited retries
		processors:        make(map[string]*queueProcessor),
		pgURI:             param.Get().PGURI,
		queueLocks:        make(map[string]map[string]chan struct{}),
		mu:                sync.Mutex{},
	}
}

// AddHandler registers a handler for a specific type of work
func (l *Listener) AddHandler(ctx context.Context, channel string, maxWorkers int, maxDuration time.Duration, handler NotificationHandler, lockKeyExtractor LockKeyExtractor) error {
	l.handlers[channel] = handler

	// Initialize queue processor
	l.processors[channel] = &queueProcessor{
		channel:          channel,
		handler:          handler,
		workerPool:       make(chan struct{}, maxWorkers),
		pollTicker:       time.NewTicker(5 * time.Second),
		maxWorkers:       maxWorkers,
		maxDuration:      maxDuration,
		lockKeyExtractor: lockKeyExtractor,
	}

	return nil
}

// Start begins listening for notifications
func (l *Listener) Start(ctx context.Context) error {
	logger.Info("Starting listener")
	
	// Establish initial connection
	var err error
	connectionTimeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	
	l.conn, err = pgx.Connect(connectionTimeoutCtx, param.Get().PGURI)
	if err != nil {
		logger.Error(fmt.Errorf("failed to connect to database: %w", err))
		
		// Try to establish connection with retry logic
		if reconnectErr := l.reconnect(ctx); reconnectErr != nil {
			return fmt.Errorf("failed to establish initial database connection: %w", reconnectErr)
		}
	}
	
	// Verify connection with a simple query
	var one int
	err = l.conn.QueryRow(connectionTimeoutCtx, "SELECT 1").Scan(&one)
	if err != nil {
		logger.Error(fmt.Errorf("initial connection test failed: %w", err))
		
		// Try to establish connection with retry logic
		if reconnectErr := l.reconnect(ctx); reconnectErr != nil {
			return fmt.Errorf("failed to establish valid database connection: %w", reconnectErr)
		}
	}

	logger.Info("Database connection established successfully")

	// Listen on all channels that have registered handlers
	logger.Info("Subscribing to notification channels", 
		zap.Int("channelCount", len(l.handlers)))
		
	channelCount := 0
	for channel := range l.handlers {
		// Use a dedicated context for each LISTEN command with timeout
		listenCtx, listenCancel := context.WithTimeout(ctx, 10*time.Second)
		
		// Add retry logic for initial listen
		var listenErr error
		for listenAttempt := 0; listenAttempt < 3; listenAttempt++ {
			if _, err := l.conn.Exec(listenCtx, fmt.Sprintf("LISTEN %s", channel)); err != nil {
				listenErr = err
				logger.Warn("Initial LISTEN command failed, retrying",
					zap.String("channel", channel),
					zap.Int("attempt", listenAttempt+1),
					zap.Error(err))
				
				// If connection is busy, wait a moment before retry
				if strings.Contains(err.Error(), "conn busy") {
					select {
					case <-time.After(500 * time.Millisecond):
					case <-listenCtx.Done():
						break
					}
				} else {
					// For other errors, a shorter retry wait
					select {
					case <-time.After(100 * time.Millisecond):
					case <-listenCtx.Done():
						break
					}
				}
			} else {
				listenErr = nil
				break
			}
		}
		
		listenCancel()
		
		if listenErr != nil {
			return fmt.Errorf("failed to listen on channel %s: %w", channel, listenErr)
		}
		
		channelCount++
		
		// Check for existing work in each queue and start processing
		processor := l.processors[channel]
		if !processor.processing {
			processor.processing = true
			go l.processQueue(ctx, processor)
		}
	}
	
	logger.Info("Successfully subscribed to all channels", 
		zap.Int("channelCount", channelCount))

	// Start processing notifications in a separate goroutine
	go l.processNotifications(ctx)
	
	logger.Info("Listener started successfully")
	return nil
}

// processNotifications now triggers message processing instead of directly handling
func (l *Listener) processNotifications(ctx context.Context) {
	// Keep track of consecutive errors to detect degraded connection state
	consecutiveErrors := 0
	maxConsecutiveErrors := 3
	lastSuccessTime := time.Now()
	healthCheckInterval := 30 * time.Second
	
	// Start a separate goroutine for periodic health checks
	go func() {
		ticker := time.NewTicker(healthCheckInterval)
		defer ticker.Stop()
		
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// Check if we've been silent for too long
				if time.Since(lastSuccessTime) > healthCheckInterval*2 {
					logger.Warn("No notification received in a while, performing health check")
					
					// Try a ping operation to verify connection
					if l.conn != nil {
						// Create a timeout context for the health check query
						healthCtx, healthCancel := context.WithTimeout(ctx, 5*time.Second)
						var result int
						err := l.conn.QueryRow(healthCtx, "SELECT 1").Scan(&result)
						healthCancel()
						
						if err != nil {
							if strings.Contains(err.Error(), "conn busy") {
								logger.Warn("Health check found busy connection, waiting before retry")
								
								// Wait a short time and try again with a fresh context
								time.Sleep(500 * time.Millisecond)
								
								retryCtx, retryCancel := context.WithTimeout(ctx, 5*time.Second)
								err = l.conn.QueryRow(retryCtx, "SELECT 1").Scan(&result)
								retryCancel()
								
								if err == nil {
									logger.Info("Connection health check passed on retry")
									lastSuccessTime = time.Now()
									continue
								}
							}
							
							logger.Error(fmt.Errorf("health check failed: %w", err))
							
							// Force a reconnection
							if reconnectErr := l.reconnect(ctx); reconnectErr != nil {
								logger.Error(fmt.Errorf("failed to reconnect after health check: %w", reconnectErr))
							} else {
								consecutiveErrors = 0 // Reset on successful reconnect
								lastSuccessTime = time.Now() // Update last success time after reconnect
							}
						} else {
							logger.Info("Connection health check passed")
							lastSuccessTime = time.Now() // Update last success time
						}
					}
				}
			}
		}
	}()
	
	for {
		// Check if context is canceled
		if ctx.Err() != nil {
			logger.Info("Context canceled, exiting notification processor")
			return
		}
		
		// Check if connection is available before waiting for notification
		if l.conn == nil {
			logger.Error(fmt.Errorf("connection is nil, attempting to reconnect"))
			if err := l.reconnect(ctx); err != nil {
				logger.Error(fmt.Errorf("failed to reconnect: %w", err))
				select {
				case <-time.After(5 * time.Second):
				case <-ctx.Done():
					return
				}
				continue
			}
		}
		
		// Set a reasonable timeout for waiting for notifications
		waitCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		notification, err := l.conn.WaitForNotification(waitCtx)
		cancel()
		
		if err != nil {
			if ctx.Err() != nil {
				// Context was canceled, exit gracefully
				return
			}
			
			// Special handling for "conn busy" errors
			if strings.Contains(err.Error(), "conn busy") {
				logger.Warn("Connection busy during WaitForNotification, waiting before retry",
					zap.String("timeSinceLastSuccess", time.Since(lastSuccessTime).String()))
				
				// Short delay before retrying with a potentially cleared connection
				select {
				case <-time.After(500 * time.Millisecond):
				case <-ctx.Done():
					return
				}
				
				// Don't increment consecutive errors for busy connection
				// This prevents unnecessary reconnection which could make things worse
				continue
			}
			
			// Check for closed connection error
			if strings.Contains(err.Error(), "closed network connection") || 
			   strings.Contains(err.Error(), "connection reset by peer") {
				logger.Warn("Connection appears to be closed, forcing reconnection")
				
				// Force connection to nil to ensure reconnection on next iteration
				if l.conn != nil {
					// Don't try to close an already closed connection
					l.conn = nil
				}
				
				// Short delay before retrying
				select {
				case <-time.After(1 * time.Second):
				case <-ctx.Done():
					return
				}
				
				continue
			}
			
			consecutiveErrors++
			logger.Error(fmt.Errorf("failed to wait for notification: %w", err),
				zap.Int("consecutiveErrors", consecutiveErrors),
				zap.String("timeSinceLastSuccess", time.Since(lastSuccessTime).String()))

			// Force a reconnection after maxConsecutiveErrors or database termination
			if consecutiveErrors >= maxConsecutiveErrors || 
			   strings.Contains(err.Error(), "terminating connection") {
				logger.Warn("Too many consecutive errors or connection terminated, forcing reconnection",
					zap.Int("consecutiveErrors", consecutiveErrors))
				
				// Attempt to reconnect with exponential backoff
				if err := l.reconnect(ctx); err != nil {
					logger.Error(fmt.Errorf("failed to reconnect: %w", err))
					
					// If reconnection fails, add a small delay to avoid thrashing
					select {
					case <-time.After(5 * time.Second):
					case <-ctx.Done():
						return
					}
				} else {
					// Reset error counter on successful reconnect
					consecutiveErrors = 0
					lastSuccessTime = time.Now()
				}
			}
			continue
		}
		
		// Reset error counter and update last success time on successful notification
		consecutiveErrors = 0
		lastSuccessTime = time.Now()

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

				lockKey := ""
				if processor.lockKeyExtractor != nil {
					var err error
					lockKey, err = processor.lockKeyExtractor(messagePayload)
					if err != nil {
						logger.Error(fmt.Errorf("failed to extract lock key: %w", err))
						return
					}
				}

				if lockKey != "" {
					lockChan := l.getQueueLock(processor.channel, lockKey)
					<-lockChan
					defer func() {
						lockChan <- struct{}{}
					}()
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

// getQueueLock returns the lock channel for a queue and lockKey, creating it if it doesn't exist
func (l *Listener) getQueueLock(queueName, lockKey string) chan struct{} {
	l.mu.Lock()
	defer l.mu.Unlock()

	if _, exists := l.queueLocks[queueName]; !exists {
		l.queueLocks[queueName] = make(map[string]chan struct{})
	}

	lockChan, exists := l.queueLocks[queueName][lockKey]
	if !exists {
		// Check if this is the execute_action queue - allow 3 concurrent workers per plan
		if queueName == "execute_action" {
			lockChan = make(chan struct{}, 1)
			lockChan <- struct{}{}
			l.queueLocks[queueName][lockKey] = lockChan

			// lockChan = make(chan struct{}, 3)
			// // Initialize with 3 slots
			// for i := 0; i < 3; i++ {
			// 	lockChan <- struct{}{}
			// }
		} else {
			// Default to single worker for other queues
			lockChan = make(chan struct{}, 1)
			lockChan <- struct{}{}
		}
		l.queueLocks[queueName][lockKey] = lockChan
	}
	return lockChan
}

// reconnect attempts to reestablish the database connection using exponential backoff
func (l *Listener) reconnect(ctx context.Context) error {
	var err error
	attempt := 0
	backoffInterval := l.reconnectInterval
	maxBackoff := 5 * time.Minute       // Cap the backoff at 5 minutes
	maxAttempts := l.maxReconnectRetry  // Use the configured max, 0 means unlimited

	// Log reconnection attempt
	logger.Info("Database connection lost, attempting to reconnect...")

	for maxAttempts == 0 || attempt < maxAttempts {
		attempt++

		// Close the old connection if it exists
		if l.conn != nil {
			l.conn.Close(ctx)
			l.conn = nil // Prevent potential use of closed connection
		}

		// Check if context is canceled
		if ctx.Err() != nil {
			return fmt.Errorf("context canceled during reconnection: %w", ctx.Err())
		}

		// Try to connect with a timeout
		connectCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		logger.Info("Attempting database reconnection", 
			zap.Int("attempt", attempt),
			zap.Duration("backoff", backoffInterval))
		
		l.conn, err = pgx.Connect(connectCtx, param.Get().PGURI)
		cancel() // Cancel the timeout context
		
		if err == nil {
			// Test the connection with a simple query
			testCtx, testCancel := context.WithTimeout(ctx, 10*time.Second)
			var one int
			err = l.conn.QueryRow(testCtx, "SELECT 1").Scan(&one)
			testCancel()
			
			if err != nil {
				logger.Error(fmt.Errorf("connection test failed: %w", err))
				// Close the connection and continue to next attempt
				if l.conn != nil {
					l.conn.Close(ctx)
					l.conn = nil
				}
			} else {
				// Resubscribe to all channels
				logger.Info("Connection reestablished, resubscribing to channels",
					zap.Int("channelCount", len(l.handlers)))
				
				// Successfully resubscribe to all channels
				resubscribeSuccess := true
				
				for channel := range l.handlers {
					// Use a short timeout for each LISTEN command
					listenCtx, listenCancel := context.WithTimeout(ctx, 5*time.Second)
					
					var listenErr error
					for listenAttempt := 0; listenAttempt < 3; listenAttempt++ {
						if _, err := l.conn.Exec(listenCtx, fmt.Sprintf("LISTEN %s", channel)); err != nil {
							listenErr = err
							logger.Warn("LISTEN command failed, retrying",
								zap.String("channel", channel),
								zap.Int("attempt", listenAttempt+1),
								zap.Error(err))
							
							// If connection is busy, wait a moment before retry
							if strings.Contains(err.Error(), "conn busy") {
								select {
								case <-time.After(500 * time.Millisecond):
								case <-listenCtx.Done():
									break
								}
							} else {
								// For other errors, the short retry wait
								select {
								case <-time.After(100 * time.Millisecond):
								case <-listenCtx.Done():
									break
								}
							}
						} else {
							listenErr = nil
							break
						}
					}
					
					listenCancel() // Always cancel the context
					
					if listenErr != nil {
						logger.Error(fmt.Errorf("failed to relisten on channel %s: %w", channel, listenErr))
						resubscribeSuccess = false
						break
					}
				}
				
				if !resubscribeSuccess {
					logger.Warn("Failed to resubscribe to all channels, retrying full reconnection")
					if l.conn != nil {
						l.conn.Close(ctx)
						l.conn = nil
					}
					continue // Try reconnection again
				}
				
				logger.Info("Successfully reconnected and resubscribed to all channels")
				
				// Immediately check for any pending work in queues
				for _, processor := range l.processors {
					if !processor.processing {
						processor.processing = true
						go l.processQueue(ctx, processor)
					}
				}
				
				return nil
			}
		} else {
			logger.Error(fmt.Errorf("failed to connect to database: %w", err))
		}

		// Exponential backoff, but with maximum cap
		nextBackoff := backoffInterval * 2
		if nextBackoff > maxBackoff {
			backoffInterval = maxBackoff
		} else {
			backoffInterval = nextBackoff
		}

		// Add some jitter (±20%)
		jitter := time.Duration(float64(backoffInterval) * (0.8 + 0.4*rand.Float64()))
		
		logger.Info("Will retry connection after backoff",
			zap.Duration("backoff", jitter),
			zap.Int("attempt", attempt))
		
		timer := time.NewTimer(jitter)
		select {
		case <-timer.C:
			// Continue with next attempt
		case <-ctx.Done():
			timer.Stop()
			return fmt.Errorf("context canceled during reconnection backoff: %w", ctx.Err())
		}
	}

	return fmt.Errorf("failed to reconnect after %d attempts", attempt)
}

// Stop gracefully shuts down the listener
func (l *Listener) Stop(ctx context.Context) error {
	if l.conn != nil {
		return l.conn.Close(ctx)
	}
	return nil
}