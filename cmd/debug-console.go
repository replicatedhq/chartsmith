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
	var workspaceID string
	var nonInteractive bool

	cmd := &cobra.Command{
		Use:   "debug-console [command] [flags]",
		Short: "Interactive debug console for chartsmith",
		Long: `A development tool that provides an interactive console for debugging and testing
chartsmith functionality without going through the LLM pipeline. This allows for faster
testing of render, patch generation, and other features.

When run without arguments, it launches an interactive console mode.
When run with a command, it executes that command and exits, suitable for scripting.

Examples:
  # Interactive mode
  debug-console
  
  # Run a single command (non-interactive mode)
  debug-console new-revision --workspace-id abc123
  debug-console patch-file values.yaml --workspace-id abc123
  debug-console render values.yaml --workspace-id abc123`,
		Args: cobra.ArbitraryArgs,
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

			// If we have command args, set non-interactive mode
			if len(args) > 0 {
				nonInteractive = true
			}

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			// Pass the workspace ID and any command arguments
			opts := debugcli.ConsoleOptions{
				WorkspaceID:    workspaceID,
				NonInteractive: nonInteractive,
				Command:        args,
			}
			return debugcli.RunConsole(opts)
		},
	}

	// Add flags
	cmd.Flags().StringVar(&workspaceID, "workspace-id", "", "Workspace ID to use for commands")

	return cmd
}
