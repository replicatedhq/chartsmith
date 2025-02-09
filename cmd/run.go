package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/replicatedhq/chartsmith/pkg/listener"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func RunCmd() *cobra.Command {
	runCmd := &cobra.Command{
		Use:   "run",
		Short: "Run the worker",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()
			if err := v.BindPFlags(cmd.Flags()); err != nil {
				return fmt.Errorf("failed to bind flags: %w", err)
			}

			sess, err := session.NewSession(aws.NewConfig().WithCredentialsChainVerboseErrors(true))
			if err != nil {
				// previous use of session.New did not fail on error
				// we have not yet initialized logging, so we cannot use saaskit/log
				fmt.Printf("Failed to create aws session: %v\n", err)
			}

			if err := param.Init(sess); err != nil {
				return fmt.Errorf("failed to init params: %w", err)
			}

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			realtime.Init(&realtimetypes.Config{
				Address: param.Get().CentrifugoAddress,
				APIKey:  param.Get().CentrifugoAPIKey,
			})

			pgOpts := persistence.PostgresOpts{
				URI: param.Get().PGURI,
			}
			if err := persistence.InitPostgres(pgOpts); err != nil {
				return fmt.Errorf("failed to initialize postgres connection: %w", err)
			}

			if err := runWorker(cmd.Context()); err != nil {
				return fmt.Errorf("worker error: %w", err)
			}
			return nil
		},
	}

	return runCmd
}

func runWorker(ctx context.Context) error {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	l := listener.NewListener()

	l.AddHandler("new_intent", func(notification *pgconn.Notification) error {
		go func() {
			if err := listener.HandleNewIntentNotification(ctx, notification.Payload); err != nil {
				fmt.Printf("Error handling new intent notification: %+v\n", err)
			}
		}()
		return nil
	})

	l.AddHandler("execute_plan", func(notification *pgconn.Notification) error {
		go func() {
			if err := listener.HandleExecutePlanNotification(ctx, notification.Payload); err != nil {
				fmt.Printf("Error handling execute plan notification: %+v\n", err)
			}
		}()
		return nil
	})

	l.AddHandler("new_converational", func(notification *pgconn.Notification) error {
		go func() {
			if err := listener.HandleConverationalNotification(ctx, notification.Payload); err != nil {
				fmt.Printf("Error handling conversational chat message notification: %+v\n", err)
			}
		}()
		return nil
	})

	l.AddHandler("execute_action", func(notification *pgconn.Notification) error {
		go func() {
			planID, pathID, err := listener.GetNextExecuteActionNotification(ctx)
			if err != nil {
				fmt.Printf("Error handling execute action notification: %+v\n", err)
			}

			if err := listener.HandleExecuteActionNotification(ctx, planID, pathID); err != nil {
				fmt.Printf("Error handling execute action notification: %+v\n", err)
			}
		}()
		return nil
	})

	l.AddHandler("new_summarize", func(notification *pgconn.Notification) error {
		go func() {
			if err := listener.HandleNewFileNotification(ctx, notification.Payload); err != nil {
				fmt.Printf("Error handling new summarize notification: %+v\n", err)
			}
		}()
		return nil
	})

	l.AddHandler("new_plan", func(notification *pgconn.Notification) error {
		go func() {
			if err := listener.HandleNewPlanNotification(ctx, notification.Payload); err != nil {
				fmt.Printf("Error handling new plan notification: %+v\n", err)
			}
		}()
		return nil
	})

	if err := l.Start(ctx); err != nil {
		return fmt.Errorf("failed to start listener: %w", err)
	}

	defer l.Stop(ctx)
	for {
		select {
		case <-sigChan:
			fmt.Println("\nReceived interrupt signal. Shutting down...")
			if err := l.Stop(ctx); err != nil {
				fmt.Printf("Error during shutdown: %v\n", err)
			}
			return nil
		}
	}
}
