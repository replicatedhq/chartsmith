package cmd

import (
	"github.com/spf13/cobra"
)

func RootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "worker",
		Short: "Worker for ChartSmith",
		Long:  `Worker that provides ChartSmith functionality`,
	}

	rootCmd.AddCommand(RunCmd())
	rootCmd.AddCommand(BootstrapCmd())
	rootCmd.AddCommand(IntegrationCmd())
	rootCmd.AddCommand(TestData())
	rootCmd.AddCommand(ArtifactHubCmd())
	rootCmd.AddCommand(DebugConsoleCmd())

	return rootCmd
}
