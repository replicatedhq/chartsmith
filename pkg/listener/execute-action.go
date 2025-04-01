// Package listener provides notification handling for various events.
package listener

import (
	"context"
	"fmt"
)

// DEPRECATED: This file is deprecated and has been replaced by apply-plan.go.
// It is kept for reference only and will be removed in a future cleanup.

// handleExecuteActionNotification is deprecated and no longer used.
// Plan execution is now handled by handleApplyPlanNotification.
func handleExecuteActionNotification(ctx context.Context, payload string) error {
	return fmt.Errorf("deprecated: execute_action has been replaced by apply_plan - this function should not be called")
}