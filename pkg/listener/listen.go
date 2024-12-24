package listener

import (
	"context"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/chat"
	"github.com/replicatedhq/chartsmith/pkg/llm"
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

		switch notification.Channel {
		case "new_chat":
			fmt.Printf("New chat notification received: %+v\n", notification)
			if err := handleNewChatNotification(ctx, notification.Payload); err != nil {
				fmt.Printf("Error handling new chat notification: %+v\n", err)
			}
		default:
			fmt.Printf("Unknown notification received: %+v\n", notification)
		}
	}
}

func handleNewChatNotification(ctx context.Context, chatID string) error {
	fmt.Printf("Handling new chat notification: %s\n", chatID)

	chatMessage, err := chat.GetChatMessage(ctx, chatID)
	if err != nil {
		return err
	}

	if chatMessage.IsComplete == true {
		return nil
	}

	go llm.SendChatMessage(ctx, chatMessage)

	return nil
}
