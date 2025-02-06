package listener

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"go.uber.org/zap"
)

var listenChannels = []string{
	"new_plan",
	"new_summarize",
	"new_slack_notification",
	"execute_plan",
	"execute_action",
	"new_converational",
	"new_intent",
}

// Configuration for concurrency limits
var (
	maxConcurrentSummarize = 1

	// Semaphores for different handlers
	summarizeSemaphore     = make(chan struct{}, maxConcurrentSummarize)
	executeActionSemaphore = make(chan struct{}, 1)
	intentSemaphore        = make(chan struct{}, 1)
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func processNextAction(ctx context.Context) (string, string, error) {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var planID, path string
	err := conn.QueryRow(ctx, `
		UPDATE action_queue
		SET started_at = NOW()
		WHERE (plan_id, path) IN (
			SELECT plan_id, path
			FROM action_queue
			WHERE started_at IS NULL
			ORDER BY created_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING plan_id, path
	`).Scan(&planID, &path)

	if err == pgx.ErrNoRows {
		return "", "", nil
	}
	if err != nil {
		return "", "", fmt.Errorf("error getting next action: %w", err)
	}

	return planID, path, nil
}

func processNextIntent(ctx context.Context) (string, error) {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var chatMessageID string
	err := conn.QueryRow(ctx, `
		UPDATE intent_queue
		SET started_at = NOW()
		WHERE chat_message_id IN (
			SELECT chat_message_id
			FROM intent_queue
			WHERE started_at IS NULL
				AND completed_at IS NULL
			ORDER BY created_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING chat_message_id
	`).Scan(&chatMessageID)

	if err == pgx.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("error getting next intent: %w", err)
	}

	return chatMessageID, nil
}

func processNextSummarize(ctx context.Context) ([]struct {
	FileID   string
	Revision int
}, error) {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	// Get next task
	rows, err := conn.Query(ctx, `
		WITH next_tasks AS (
			SELECT file_id, revision
			FROM summarize_queue
			WHERE completed_at IS NULL
			ORDER BY RANDOM()
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE summarize_queue sq
		SET started_at = NOW()
		FROM next_tasks
		WHERE sq.file_id = next_tasks.file_id
			AND sq.revision = next_tasks.revision
		RETURNING sq.file_id, sq.revision
	`)
	if err != nil {
		return nil, fmt.Errorf("error getting next summarize tasks: %w", err)
	}
	defer rows.Close()

	var tasks []struct {
		FileID   string
		Revision int
	}

	for rows.Next() {
		var task struct {
			FileID   string
			Revision int
		}
		if err := rows.Scan(&task.FileID, &task.Revision); err != nil {
			return nil, fmt.Errorf("error scanning summarize task: %w", err)
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func Listen(ctx context.Context) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	for _, channel := range listenChannels {
		_, err := conn.Exec(ctx, fmt.Sprintf("LISTEN %s", channel))
		if err != nil {
			return fmt.Errorf("failed to listen on channel %s: %w", channel, err)
		}
		fmt.Printf("Listening on channel: %s\n", channel)
	}

	idleTimer := time.NewTimer(3 * time.Second)
	defer idleTimer.Stop()

	// Check for work immediately on startup
	fmt.Printf("Checking for pending work on startup...\n")
	checkForPendingWork(ctx)

	for {
		idleTimer.Reset(3 * time.Second)

		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-idleTimer.C:
				checkForPendingWork(ctx)
				continue
			default:
				return fmt.Errorf("waiting for notification: %w", err)
			}
		}

		// Try to claim this notification for processing
		if notification.Channel != "execute_action" { // Skip claiming for execute_action
			claimed, err := claimNotification(ctx, notification.Channel, notification.Payload)
			if err != nil {
				fmt.Printf("Error claiming notification: %v\n", err)
				continue
			}

			if !claimed {
				fmt.Printf("Notification in channel %s already claimed by another process\n", notification.Channel)
				continue
			}
		}

		if notification.Channel == "execute_action" {
			// Try to acquire semaphore
			select {
			case executeActionSemaphore <- struct{}{}:
				// Got the semaphore, try to get next action
				planID, path, err := processNextAction(ctx)
				if err != nil {
					fmt.Printf("Error processing next action: %v\n", err)
					<-executeActionSemaphore
					continue
				}
				if planID == "" {
					// No actions to process
					<-executeActionSemaphore
					continue
				}

				// Process the action
				go func(pid, p string) {
					defer func() {
						// Check for more pending actions before releasing semaphore
						for {
							nextPlanID, nextPath, err := processNextAction(ctx)
							if err != nil {
								fmt.Printf("Error checking for next action: %v\n", err)
								<-executeActionSemaphore
								return
							}
							if nextPlanID == "" {
								// No more pending actions
								<-executeActionSemaphore
								return
							}

							fmt.Printf("Found pending action: %s/%s\n", nextPlanID, nextPath)
							if err := handleExecuteActionNotification(ctx, nextPlanID, nextPath); err != nil {
								fmt.Printf("Error handling execute action: %v\n", err)
								conn := persistence.MustGeUunpooledPostgresSession()
								defer conn.Close(ctx)
								conn.Exec(ctx, `
									UPDATE action_queue
									SET completed_at = NOW()
									WHERE plan_id = $1 AND path = $2
								`, nextPlanID, nextPath)
								continue
							}

							// Mark action as completed
							conn := persistence.MustGeUunpooledPostgresSession()
							defer conn.Close(ctx)
							conn.Exec(ctx, `
								UPDATE action_queue
								SET completed_at = NOW()
								WHERE plan_id = $1 AND path = $2
							`, nextPlanID, nextPath)
						}
					}()

					// Handle the initial action
					if err := handleExecuteActionNotification(ctx, pid, p); err != nil {
						fmt.Printf("Error handling execute action: %v\n", err)
						conn := persistence.MustGeUunpooledPostgresSession()
						defer conn.Close(ctx)
						conn.Exec(ctx, `
							UPDATE action_queue
							SET completed_at = NOW()
							WHERE plan_id = $1 AND path = $2
						`, pid, p)
					} else {
						conn := persistence.MustGeUunpooledPostgresSession()
						defer conn.Close(ctx)
						conn.Exec(ctx, `
							UPDATE action_queue
							SET completed_at = NOW()
							WHERE plan_id = $1 AND path = $2
						`, pid, p)
					}
				}(planID, path)

			default:
				continue
			}
			continue // Skip the switch statement for execute_action
		}

		logger.Debug("Processing notification",
			zap.String("channel", notification.Channel),
			zap.String("payload", notification.Payload),
		)
		switch notification.Channel {
		case "new_summarize":
			// Try to acquire semaphore
			select {
			case summarizeSemaphore <- struct{}{}:
				// Add random delay between 0-5 seconds
				delay := time.Duration(rand.Float64()*5000) * time.Millisecond

				go func(payload string, d time.Duration) {
					time.Sleep(d)
					logger.Debug("Starting delayed summarize task",
						zap.String("payload", payload),
						zap.Duration("delay", d))
					processSummarizeQueue(ctx, payload)
				}(notification.Payload, delay)
			default:
				logger.Debug("Summarize semaphore busy, skipping summarize processing")
			}
		case "new_plan":
			go func() {
				if err := handleNewPlanNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new plan notification: %+v\n", err)
				}
			}()
		case "new_converational":
			go func() {
				if err := handleConverationalNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling conversational chat message notification: %+v\n", err)
				}
			}()
		case "execute_plan":
			go func() {
				if err := handleExecutePlanNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling execute plan notification: %+v\n", err)
				}
			}()
		case "new_intent":
			// Launch a goroutine to handle the intent processing
			go func() {
				// Try to acquire semaphore
				select {
				case intentSemaphore <- struct{}{}:
					// First mark the notification intent as started to prevent it from being picked up by queue processing
					conn := persistence.MustGeUunpooledPostgresSession()
					_, err := conn.Exec(ctx, `
						UPDATE intent_queue
						SET started_at = NOW()
						WHERE chat_message_id = $1 AND started_at IS NULL
					`, notification.Payload)
					conn.Close(ctx)
					if err != nil {
						logger.Error(fmt.Errorf("error marking notification intent as started: %w", err))
						<-intentSemaphore
						return
					}

					// Process the notification payload
					logger.Debug("Processing new intent notification", zap.String("intent_id", notification.Payload))
					if err := handleNewIntentNotification(ctx, notification.Payload); err != nil {
						logger.Error(fmt.Errorf("error handling intent notification: %w", err))
						<-intentSemaphore
						return
					}

					// Mark the notification intent as completed
					markIntentCompleted(ctx, notification.Payload)

					// Process any remaining intents in the queue
					for {
						intentID, err := processNextIntent(ctx)
						if err != nil {
							logger.Error(fmt.Errorf("error processing next intent: %w", err))
							<-intentSemaphore
							return
						}
						if intentID == "" {
							<-intentSemaphore
							return
						}

						logger.Debug("Processing queued intent", zap.String("intent_id", intentID))
						if err := handleNewIntentNotification(ctx, intentID); err != nil {
							logger.Error(fmt.Errorf("error handling queued intent: %w", err))
							continue
						}

						markIntentCompleted(ctx, intentID)
					}
				default:
					logger.Debug("Intent semaphore busy, skipping intent processing")
				}
			}()
		default:
			fmt.Printf("Unknown notification received: %+v\n", notification)
		}
	}
}

// Helper function to check and process pending work
func checkForPendingWork(ctx context.Context) {
	fmt.Printf("Checking for pending work...\n")

	// Check for pending actions
	select {
	case executeActionSemaphore <- struct{}{}:
		// Got the semaphore, try to get next action
		planID, path, err := processNextAction(ctx)
		if err != nil {
			fmt.Printf("Error processing next action: %v\n", err)
			<-executeActionSemaphore
		} else if planID == "" {
			// No actions to process
			fmt.Printf("No pending actions found\n")
			<-executeActionSemaphore
		} else {
			fmt.Printf("Found pending action: %s/%s\n", planID, path)
			go handleExecuteActionWithLoop(ctx, planID, path)
		}
	default:
		fmt.Printf("Action semaphore busy, skipping action check\n")
	}

	// Check for pending intents
	select {
	case intentSemaphore <- struct{}{}:
		// Got the semaphore, try to get next intent
		intentID, err := processNextIntent(ctx)
		if err != nil {
			logger.Error(fmt.Errorf("error processing next intent: %w", err))
			<-intentSemaphore
		} else if intentID == "" {
			logger.Debug("No pending intents found")
			<-intentSemaphore
		} else {
			logger.Debug("Processing pending intent", zap.String("intent_id", intentID))
			// Process the intent and then check for more
			go processIntentQueue(ctx, intentID)
		}
	default:
		logger.Debug("Intent semaphore busy, skipping intent check")
	}

	// Check for pending summarize tasks
	checkForPendingSummarize(ctx)
}

func claimNotification(ctx context.Context, notificationChannel string, notificationID string) (bool, error) {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var claimed bool
	err := conn.QueryRow(ctx, `
        INSERT INTO notification_processing (
			notification_channel,
            notification_id,
            claimed_at,
            claimed_by
        )
        VALUES ($1, $2, NOW(), pg_backend_pid())
        ON CONFLICT (notification_channel, notification_id) DO NOTHING
        RETURNING true
    `, notificationChannel, notificationID).Scan(&claimed)

	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// Extract the action handling loop into its own function for reuse
func handleExecuteActionWithLoop(ctx context.Context, planID string, path string) {
	defer func() {
		// Check for more pending actions before releasing semaphore
		for {
			nextPlanID, nextPath, err := processNextAction(ctx)
			if err != nil {
				fmt.Printf("Error checking for next action: %v\n", err)
				<-executeActionSemaphore
				return
			}
			if nextPlanID == "" {
				// No more pending actions
				<-executeActionSemaphore
				return
			}

			fmt.Printf("Found pending action: %s/%s\n", nextPlanID, nextPath)
			if err := handleExecuteActionNotification(ctx, nextPlanID, nextPath); err != nil {
				fmt.Printf("Error handling execute action: %v\n", err)
				conn := persistence.MustGeUunpooledPostgresSession()
				defer conn.Close(ctx)
				conn.Exec(ctx, `
					UPDATE action_queue
					SET completed_at = NOW()
					WHERE plan_id = $1 AND path = $2
				`, nextPlanID, nextPath)
				continue
			}

			// Mark action as completed
			conn := persistence.MustGeUunpooledPostgresSession()
			defer conn.Close(ctx)
			conn.Exec(ctx, `
				UPDATE action_queue
				SET completed_at = NOW()
				WHERE plan_id = $1 AND path = $2
			`, nextPlanID, nextPath)
		}
	}()

	// Handle the initial action
	if err := handleExecuteActionNotification(ctx, planID, path); err != nil {
		fmt.Printf("Error handling execute action: %v\n", err)
		conn := persistence.MustGeUunpooledPostgresSession()
		defer conn.Close(ctx)
		conn.Exec(ctx, `
			UPDATE action_queue
			SET completed_at = NOW()
			WHERE plan_id = $1 AND path = $2
		`, planID, path)
	} else {
		conn := persistence.MustGeUunpooledPostgresSession()
		defer conn.Close(ctx)
		conn.Exec(ctx, `
			UPDATE action_queue
			SET completed_at = NOW()
			WHERE plan_id = $1 AND path = $2
		`, planID, path)
	}
}

// Helper function to process the intent queue
func processIntentQueue(ctx context.Context, initialIntentID string) {
	defer func() { <-intentSemaphore }()

	// Process the initial intent
	if err := handleNewIntentNotification(ctx, initialIntentID); err != nil {
		logger.Error(fmt.Errorf("error handling initial intent: %w", err))
		return
	}

	// Mark initial intent as completed
	markIntentCompleted(ctx, initialIntentID)

	// Then check for any other pending intents
	for {
		nextIntentID, err := processNextIntent(ctx)
		if err != nil {
			logger.Error(fmt.Errorf("error processing next intent: %w", err))
			return
		}
		if nextIntentID == "" {
			return // No more intents to process
		}

		logger.Debug("Processing next intent from queue", zap.String("intent_id", nextIntentID))
		if err := handleNewIntentNotification(ctx, nextIntentID); err != nil {
			logger.Error(fmt.Errorf("error handling next intent: %w", err))
			continue
		}

		markIntentCompleted(ctx, nextIntentID)
	}
}

func markIntentCompleted(ctx context.Context, intentID string) {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	_, err := conn.Exec(ctx, `
		UPDATE intent_queue
		SET completed_at = NOW()
		WHERE chat_message_id = $1
	`, intentID)

	if err != nil {
		logger.Error(fmt.Errorf("error marking intent as completed: %w", err))
	}
}

// Update processSummarizeQueue to be simpler
func processSummarizeQueue(ctx context.Context, initialFileID string) {
	defer func() {
		<-summarizeSemaphore
		logger.Debug("Summarize worker finished", zap.String("file_id", initialFileID))
		// Check for more work
		go checkForPendingSummarize(ctx)
	}()

	logger.Debug("Starting summarize worker", zap.String("file_id", initialFileID))

	// Parse the ID
	parts := strings.Split(initialFileID, "/")
	if len(parts) != 2 {
		logger.Error(fmt.Errorf("invalid file ID format: %s", initialFileID))
		return
	}

	fileID := parts[0]
	revision, err := strconv.Atoi(parts[1])
	if err != nil {
		logger.Error(fmt.Errorf("failed to parse revision number: %w", err))
		return
	}

	// Do the work
	err = handleNewFileNotification(ctx, initialFileID)

	// Always mark as completed, regardless of error
	if markErr := markSummarizeCompleted(ctx, fileID, revision); markErr != nil {
		logger.Error(fmt.Errorf("failed to mark task as completed: %w", markErr))
	}

	// Log the original error if there was one
	if err != nil {
		logger.Error(fmt.Errorf("failed to handle summarize task: %w", err))
	}
}

// Update checkForPendingSummarize to be simpler
func checkForPendingSummarize(ctx context.Context) {
	tasks, err := processNextSummarize(ctx)
	if err != nil {
		logger.Error(fmt.Errorf("error processing next summarize tasks: %w", err))
		return
	}

	if len(tasks) == 0 {
		return // No more tasks to process
	}

	// Try to start worker for the task
	select {
	case summarizeSemaphore <- struct{}{}:
		task := tasks[0]
		logger.Debug("Processing pending summarize task",
			zap.String("file_id", task.FileID),
			zap.Int("revision", task.Revision))
		go processSummarizeQueue(ctx, fmt.Sprintf("%s/%d", task.FileID, task.Revision))
	default:
		logger.Debug("Summarize semaphore full, skipping summarize check")
	}
}

// Update markSummarizeCompleted to return error
func markSummarizeCompleted(ctx context.Context, fileID string, revisionNumber int) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	_, err := conn.Exec(ctx, `
		UPDATE summarize_queue
		SET completed_at = NOW()
		WHERE file_id = $1 AND revision = $2
	`, fileID, revisionNumber)

	return err
}
