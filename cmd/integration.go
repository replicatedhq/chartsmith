package cmd

import (
	"context"
	"fmt"
	"os/signal"
	"syscall"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/testhelpers"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func IntegrationCmd() *cobra.Command {
	integrationCmd := &cobra.Command{
		Use:   "integration",
		Short: "Run integration tests",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()
			if err := v.BindPFlags(cmd.Flags()); err != nil {
				return fmt.Errorf("failed to bind flags: %w", err)
			}

			// we always init params without aws,
			// b/c we always use os env for tests
			if err := param.Init(nil); err != nil {
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

			if err := runIntegrationTests(ctx); err != nil {
				return fmt.Errorf("failed to run integration tests: %w", err)
			}

			return nil
		},
	}

	return integrationCmd
}

func runIntegrationTests(ctx context.Context) error {
	pgTestContainer, err := testhelpers.CreatePostgresContainer(ctx)
	if err != nil {
		return fmt.Errorf("failed to create postgres container: %w", err)
	}
	defer pgTestContainer.Terminate(ctx)

	if err := persistence.InitPostgres(persistence.PostgresOpts{
		URI: pgTestContainer.ConnectionString,
	}); err != nil {
		return fmt.Errorf("failed to init postgres: %w", err)
	}

	// run through the integration tests
	if err := llm.IntegrationTest_ApplyChangesToWorkspace(); err != nil {
		return fmt.Errorf("failed to run integration tests: %w", err)
	}

	return nil
}
