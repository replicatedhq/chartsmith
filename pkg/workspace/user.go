package workspace

import (
	"context"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

// GetUserSecureBuildSetting retrieves the user's SecureBuild setting from the database
func GetUserSecureBuildSetting(ctx context.Context, userID string) (bool, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	var value string
	err := conn.QueryRow(ctx, `
		SELECT value
		FROM chartsmith_user_setting
		WHERE user_id = $1 AND key = 'use_secure_build_images'
	`, userID).Scan(&value)

	if err != nil {
		// If no setting found, return false (default)
		return false, nil
	}

	return value == "true", nil
}