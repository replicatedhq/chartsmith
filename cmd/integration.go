package cmd

import (
	"context"
	"fmt"
	"os/signal"
	"strings"
	"syscall"

	"github.com/replicatedhq/chartsmith/pkg/integration"
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
		Use:           "integration",
		Short:         "Run integration tests",
		SilenceUsage:  true,
		SilenceErrors: true,
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

			missingParams := []string{}

			if param.Get().AnthropicAPIKey == "" {
				missingParams = append(missingParams, "ANTHROPIC_API_KEY")
			}
			if param.Get().VoyageAPIKey == "" {
				missingParams = append(missingParams, "VOYAGE_API_KEY")
			}

			if len(missingParams) > 0 {
				return fmt.Errorf("missing required params: %s", strings.Join(missingParams, ", "))
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
	opts := testhelpers.CreatePostgresContainerOpts{
		InstallExtensions: true,
		CreateSchema:      true,
		StaticData:        true,
	}

	pgTestContainer, err := testhelpers.CreatePostgresContainer(ctx, opts)
	if err != nil {
		return fmt.Errorf("failed to create postgres container: %w", err)
	}
	defer pgTestContainer.Terminate(ctx)

	if err := persistence.InitPostgres(persistence.PostgresOpts{
		URI: pgTestContainer.ConnectionString,
	}); err != nil {
		return fmt.Errorf("failed to init postgres: %w", err)
	}

	if err := integration.IntegrationTest_ChooseRelevantFilesForChatMessage(); err != nil {
		return fmt.Errorf("failed to run integration tests: %w", err)
	}

	return nil
}
