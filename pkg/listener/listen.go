package listener

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

// executeActionSemaphore is a channel that acts as a semaphore to ensure only one execute_action runs at a time
var executeActionSemaphore = make(chan struct{}, 1)

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

func Listen(ctx context.Context) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	channels := []string{"new_plan", "new_file", "new_slack_notification", "execute_plan", "execute_action"}
	for _, channel := range channels {
		_, err := conn.Exec(ctx, fmt.Sprintf("LISTEN %s", channel))
		if err != nil {
			return fmt.Errorf("failed to listen on channel %s: %w", channel, err)
		}
		fmt.Printf("Listening on channel: %s\n", channel)
	}

	for {
		fmt.Printf("Waiting for notification...\n")
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			return fmt.Errorf("waiting for notification: %w", err)
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
						// Instead of just releasing semaphore, check for more work
						for {
							nextPlanID, nextPath, err := processNextAction(ctx)
							if err != nil {
								fmt.Printf("Error checking for next action: %v\n", err)
								<-executeActionSemaphore
								return
							}
							if nextPlanID == "" {
								// No more work to do
								<-executeActionSemaphore
								return
							}

							// Process the next action
							fmt.Printf("Processing next action: %s/%s\n", nextPlanID, nextPath)
							if err := handleExecuteActionNotification(ctx, nextPlanID, nextPath); err != nil {
								fmt.Printf("Error handling execute action: %v\n", err)
								conn := persistence.MustGeUunpooledPostgresSession()
								defer conn.Close(ctx)
								conn.Exec(ctx, `
									UPDATE action_queue
									SET completed_at = NOW()
									WHERE plan_id = $1 AND path = $2
								`, nextPlanID, nextPath)
							} else {
								conn := persistence.MustGeUunpooledPostgresSession()
								defer conn.Close(ctx)
								conn.Exec(ctx, `
									UPDATE action_queue
									SET completed_at = NOW()
									WHERE plan_id = $1 AND path = $2
								`, nextPlanID, nextPath)
							}
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

		switch notification.Channel {
		case "new_file":
			go func() {
				if err := handleNewFileNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new GVK notification: %+v\n", err)
				}
			}()
		case "new_plan":
			go func() {
				if err := handleNewPlanNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling new plan notification: %+v\n", err)
				}
			}()
		case "execute_plan":
			go func() {
				if err := handleExecutePlanNotification(ctx, notification.Payload); err != nil {
					fmt.Printf("Error handling execute plan notification: %+v\n", err)
				}
			}()
		default:
			fmt.Printf("Unknown notification received: %+v\n", notification)
		}
	}
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
