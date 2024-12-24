package listener

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

func Listen(ctx context.Context) error {
	conn := persistence.MustGeUunpooledPostgresSession()
	defer conn.Close(ctx)

	_, err := conn.Exec(ctx, "LISTEN new_chat")
	if err != nil {
		return err
	}

	for {
		fmt.Printf("Waiting for notification...\n")
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			return err
		}

		fmt.Printf("Notification received: %+v\n", notification)
	}
}
