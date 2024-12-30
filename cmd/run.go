package cmd

import (
	"context"
	"fmt"
	"os/signal"
	"syscall"

	"github.com/replicatedhq/chartsmith/pkg/listener"
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

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()

			realtime.Init(&realtimetypes.Config{
				Address: v.GetString("centrifugo-address"),
				APIKey:  v.GetString("centrifugo-api-key"),
			})

			ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer stop()

			if err := runWorker(ctx, v.GetString("pg-uri")); err != nil {
				return fmt.Errorf("worker error: %w", err)
			}
			return nil
		},
	}

	runCmd.Flags().String("pg-uri", "", "Postgres URI")
	runCmd.Flags().String("centrifugo-address", "http://localhost:8000/api", "centrifugo address")
	runCmd.Flags().String("centrifugo-api-key", "api_key", "centrifugo api key")

	return runCmd
}

func runWorker(ctx context.Context, pgURI string) error {
	pgOpts := persistence.PostgresOpts{
		URI: pgURI,
	}
	if err := persistence.InitPostgres(pgOpts); err != nil {
		return fmt.Errorf("failed to initialize postgres connection: %w", err)
	}

	if err := listener.Listen(ctx); err != nil {
		return fmt.Errorf("failed to start listener: %w", err)
	}

	return nil
}
