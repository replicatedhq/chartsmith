package listener

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

func handleNewFileNotification(ctx context.Context, id string) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	var processingErr error
	defer func() {
		var errorMsg *string
		if processingErr != nil {
			errStr := processingErr.Error()
			errorMsg = &errStr
		}

		_, updateErr := conn.Exec(ctx, `
            UPDATE notification_processing
            SET processed_at = NOW(),
                error = $1
            WHERE notification_channel = $2 and notification_id = $3
        `, errorMsg, "new_file", id)

		if updateErr != nil {
			fmt.Printf("Failed to update notification status: %v\n", updateErr)
		}
	}()

	fmt.Printf("Handling new file notification: %s\n", id)

	// gvk, err := workspace.GetFile(ctx, id)
	// if err != nil {
	// 	processingErr = err
	// 	return err
	// }

	// summary, err := llm.SummarizeGVK(ctx, gvk.Content)
	// if err != nil {
	// 	processingErr = err
	// 	return err
	// }

	// gvk.Summary = &summary

	return nil
}
