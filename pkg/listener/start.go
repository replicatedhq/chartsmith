package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/replicatedhq/chartsmith/pkg/logger"
)

func StartListeners(ctx context.Context) error {
	l := NewListener()
	l.AddHandler(ctx, "new_intent", 5, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleNewIntentNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle new intent notification: %w", err))
			return fmt.Errorf("failed to handle new intent notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "new_summarize", 20, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleNewSummarizeNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle new summarize notification: %w", err))
			return fmt.Errorf("failed to handle new summarize notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "new_plan", 5, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleNewPlanNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle new plan notification: %w", err))
			return fmt.Errorf("failed to handle new plan notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "new_converational", 5, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleConverationalNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle new converational notification: %w", err))
			return fmt.Errorf("failed to handle new converational notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "execute_plan", 5, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleExecutePlanNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle execute plan notification: %w", err))
			return fmt.Errorf("failed to handle execute plan notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "execute_action", 10, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleExecuteActionNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle execute action notification: %w", err))
			return fmt.Errorf("failed to handle execute action notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "render_workspace", 5, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleRenderWorkspaceNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle render workspace notification: %w", err))
			return fmt.Errorf("failed to handle render workspace notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "new_conversion", 5, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleNewConversionNotification(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle new conversion notification: %w", err))
			return fmt.Errorf("failed to handle new conversion notification: %w", err)
		}
		return nil
	}, nil)

	l.AddHandler(ctx, "conversion_file", 10, time.Second*10, func(notification *pgconn.Notification) error {
		if err := handleConversionFileNotificationWithLock(ctx, notification.Payload); err != nil {
			logger.Error(fmt.Errorf("failed to handle conversion file notification: %w", err))
			return fmt.Errorf("failed to handle conversion file notification: %w", err)
		}
		return nil
	}, conversionFileLockKeyExtractor)

	l.Start(ctx)
	defer l.Stop(ctx)

	// wait for ctx to be done
	<-ctx.Done()

	return nil
}

func conversionFileLockKeyExtractor(payload []byte) (string, error) {
	var payloadMap map[string]interface{}
	if err := json.Unmarshal(payload, &payloadMap); err != nil {
		return "", fmt.Errorf("failed to unmarshal payload: %w", err)
	}
	conversionID, ok := payloadMap["conversionId"].(string)
	if !ok || conversionID == "" {
		return "", fmt.Errorf("conversionId not found in payload or is not a string: %v", payloadMap)
	}
	return conversionID, nil
}

func handleConversionFileNotificationWithLock(ctx context.Context, payload string) error {
	return handleConversionFileNotification(ctx, payload)
}
