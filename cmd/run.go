package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/replicatedhq/chartsmith/pkg/listener"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
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

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			sigs := make(chan os.Signal, 1)
			signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

			var wg sync.WaitGroup
			errChan := make(chan error, 1)

			wg.Add(1)
			go func() {
				defer wg.Done()
				if err := runWorker(ctx, v.GetString("pg-uri")); err != nil {
					select {
					case errChan <- err:
					default:
						// Prevent blocking if error channel is full
					}
				}
			}()

			go func() {
				wg.Wait()
				close(errChan)
			}()

			select {
			case <-sigs:
				cancel()
				wg.Wait()
				return nil
			case err, ok := <-errChan:
				if ok {
					cancel()
					wg.Wait()
					return fmt.Errorf("worker error: %w", err)
				}
				return nil
			}
		},
	}

	runCmd.Flags().String("pg-uri", "", "Postgres URI")

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
