package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tuvistavie/securerandom"
)

func BootstrapCmd() *cobra.Command {
	bootstrapCmd := &cobra.Command{
		Use:   "bootstrap",
		Short: "Bootstrap the initial chart data",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()
			if err := v.BindPFlags(cmd.Flags()); err != nil {
				return fmt.Errorf("failed to bind flags: %w", err)
			}

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()

			// list all viper fields
			fmt.Printf("viper fields:\n")
			for _, field := range v.AllKeys() {
				fmt.Printf("  %s: %s\n", field, v.Get(field))
			}

			if err := runBootstrap(cmd.Context(), v.GetString("pg-uri"), v.GetString("chart-dir")); err != nil {
				return fmt.Errorf("failed to bootstrap chart: %w", err)
			}

			return nil
		},
	}

	wd, err := os.Getwd()
	if err != nil {
		return nil
	}

	bootstrapCmd.Flags().String("pg-uri", "", "Postgres URI")
	bootstrapCmd.Flags().String("chart-dir", filepath.Join(wd, "bootstrap-chart"), "Chart directory")

	return bootstrapCmd
}

func runBootstrap(ctx context.Context, pgURI string, chartDir string) error {
	fmt.Printf("Bootstrapping initial chart data from %s...\n", chartDir)

	pgOpts := persistence.PostgresOpts{
		URI: pgURI,
	}
	if err := persistence.InitPostgres(pgOpts); err != nil {
		return fmt.Errorf("failed to initialize postgres connection: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// remove existing data
	_, err = tx.Exec(ctx, "DELETE FROM bootstrap_file")
	if err != nil {
		return fmt.Errorf("failed to delete files: %w", err)
	}

	_, err = tx.Exec(ctx, "DELETE FROM bootstrap_gvk")
	if err != nil {
		return fmt.Errorf("failed to delete GVKs: %w", err)
	}

	// walk the chart directory and insert files
	err = filepath.Walk(chartDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return fmt.Errorf("failed to walk chart directory: %w", err)
		}
		if info.IsDir() {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		// insert the file
		filePath := filepath.ToSlash(path)
		// remove the chartDir from filePath, so make it relative to that
		filePath = strings.TrimPrefix(filePath, chartDir)

		name := info.Name()

		_, err = tx.Exec(ctx, `
            INSERT INTO bootstrap_file (file_path, content, name)
            VALUES ($1, $2, $3)
        `, filePath, string(content), name)
		if err != nil {
			return fmt.Errorf("failed to insert file: %w", err)
		}

		// insert the GVK
		id, err := securerandom.Hex(12)
		if err != nil {
			return fmt.Errorf("failed to generate GVK ID: %w", err)
		}

		gvk, err := workspace.ParseGVK(filePath, string(content))
		if err != nil {
			return fmt.Errorf("failed to parse GVK: %w", err)
		}

		_, err = tx.Exec(ctx, `
            INSERT INTO bootstrap_gvk (id, gvk, file_path, content)
            VALUES ($1, $2, $3, $4)
        `, id, gvk, filePath, content)
		if err != nil {
			return fmt.Errorf("failed to insert GVK: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to insert GVKs: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// we closed that tx, so now let's iterate through the GVKs and summarize, embeddings them

	rows, err := conn.Query(ctx, `
        SELECT
        bootstrap_gvk.id,
        bootstrap_gvk.gvk,
        bootstrap_gvk.file_path,
        bootstrap_gvk.content
    FROM
        bootstrap_gvk`)
	if err != nil {
		return fmt.Errorf("failed to query GVKs: %w", err)
	}
	defer rows.Close()

	type Summarized struct {
		Content string
	}
	summaries := map[string]Summarized{}

	for rows.Next() {
		var gvk types.GVK

		err := rows.Scan(
			&gvk.ID,
			&gvk.GVK,
			&gvk.FilePath,
			&gvk.Content,
		)
		if err != nil {
			return fmt.Errorf("failed to scan GVK: %w", err)
		}

		summaries[gvk.ID] = Summarized{
			Content: gvk.Content,
		}
	}
	rows.Close()

	// now we have all the summaries, let's insert them
	for id, summary := range summaries {
		description, err := llm.SummarizeGVK(ctx, summary.Content)
		if err != nil {
			return fmt.Errorf("failed to summarize GVK: %w", err)
		}

		embeddings, err := llm.Embeddings(summary.Content)
		if err != nil {
			return fmt.Errorf("failed to get embeddings: %w", err)
		}

		_, err = conn.Exec(ctx, `
            UPDATE bootstrap_gvk
            SET summary = $1, embeddings = $2
            WHERE id = $3
        `, description, embeddings, id)
		if err != nil {
			return fmt.Errorf("failed to update GVK summary: %w", err)
		}
	}

	return nil
}
