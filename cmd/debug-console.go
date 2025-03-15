package cmd

import (
	"fmt"
	"os"

	"github.com/replicatedhq/chartsmith/pkg/debugcli"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/spf13/cobra"
)

func DebugConsoleCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "debug-console",
		Short: "Interactive debug console for chartsmith",
		Long: `A development tool that provides an interactive console for debugging and testing
chartsmith functionality without going through the LLM pipeline. This allows for faster
testing of render, patch generation, and other features.`,
		PreRunE: func(cmd *cobra.Command, args []string) error {
			// we always init params without aws,
			// b/c we always use os env for tests
			if err := param.Init(nil); err != nil {
				return fmt.Errorf("failed to init params: %w", err)
			}

			pgOpts := persistence.PostgresOpts{
				URI: os.Getenv("DB_URI"),
			}
			if err := persistence.InitPostgres(pgOpts); err != nil {
				return fmt.Errorf("failed to initialize postgres connection: %w", err)
			}

			realtime.Init(&realtimetypes.Config{
				Address: param.Get().CentrifugoAddress,
				APIKey:  param.Get().CentrifugoAPIKey,
			})

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return debugcli.RunConsole()
		},
	}

	return cmd
}
