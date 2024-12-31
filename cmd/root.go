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

	return rootCmd
}
