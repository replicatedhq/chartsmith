package cmd

import (
	"context"
	"fmt"
	"os/signal"
	"syscall"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/replicatedhq/chartsmith/pkg/api"
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

			ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer stop()

			if err := runWorker(ctx, param.Get().PGURI); err != nil {
				return fmt.Errorf("worker error: %w", err)
			}
			return nil
		},
	}

	return runCmd
}

func runWorker(ctx context.Context, pgURI string) error {
	pgOpts := persistence.PostgresOpts{
		URI: pgURI,
	}
	if err := persistence.InitPostgres(pgOpts); err != nil {
		return fmt.Errorf("failed to initialize postgres connection: %w", err)
	}

	// Start the connection heartbeat before starting the listeners
	// This ensures our connections stay alive even during idle periods
	listener.StartHeartbeat(ctx)
	
	// Start HTTP server for API endpoints (chat streaming, etc.)
	go func() {
		port := 8080 // Default port for local development
		if err := api.StartHTTPServer(ctx, port); err != nil {
			fmt.Printf("HTTP server error: %v\n", err)
		}
	}()

	// Start PostgreSQL LISTEN/NOTIFY listeners
	if err := listener.StartListeners(ctx); err != nil {
		return fmt.Errorf("failed to start listeners: %w", err)
	}

	return nil
}
