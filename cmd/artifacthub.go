package cmd

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

type HarborPackage struct {
	Repository string `json:"repository"`
	Package    string `json:"package"`
	Version    string `json:"version"`
	URL        string `json:"url"`
}

func ArtifactHubCmd() *cobra.Command {
	artifactHubCmd := &cobra.Command{
		Use:   "artifacthub",
		Short: "Cache ArtifactHub Helm chart information",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()
			if err := v.BindPFlags(cmd.Flags()); err != nil {
				return fmt.Errorf("failed to bind flags: %w", err)
			}

			sess, err := session.NewSession(aws.NewConfig().WithCredentialsChainVerboseErrors(true))
			if err != nil {
				fmt.Printf("Failed to create aws session: %v\n", err)
			}

			if err := param.Init(sess); err != nil {
				return fmt.Errorf("failed to init params: %w", err)
			}

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()

			if err := runArtifactHubCache(
				cmd.Context(),
				param.Get().PGURI,
				v.GetBool("force"),
				v.GetBool("verbose"),
			); err != nil {
				return fmt.Errorf("failed to cache ArtifactHub charts: %w", err)
			}

			return nil
		},
	}

	artifactHubCmd.Flags().Bool("force", false, "Force cache refresh even if recently updated")
	artifactHubCmd.Flags().Bool("verbose", false, "Show verbose output")

	return artifactHubCmd
}

func runArtifactHubCache(ctx context.Context, pgURI string, force bool, verbose bool) error {
	logger.Info("Starting ArtifactHub chart cache update")

	pgOpts := persistence.PostgresOpts{
		URI: pgURI,
	}
	if err := persistence.InitPostgres(pgOpts); err != nil {
		return fmt.Errorf("failed to initialize postgres connection: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Check if we need to refresh the cache
	if !force {
		var lastUpdated sql.NullTime
		err := conn.QueryRow(ctx, `SELECT value::timestamp FROM artifacthub_meta WHERE key = 'last_updated'`).Scan(&lastUpdated)
		if err != nil && err != pgx.ErrNoRows {
			return fmt.Errorf("failed to get last updated time: %w", err)
		}
		
		if lastUpdated.Valid {
			// If cache was updated in the last 6 hours, skip
			if time.Since(lastUpdated.Time) < 6*time.Hour {
				logger.Info(fmt.Sprintf("ArtifactHub cache was updated less than 6 hours ago (%s), skipping refresh", lastUpdated.Time))
				return nil
			}
		}
	}

	logger.Info("Fetching ArtifactHub Harbor replication dump...")

	// Fetch the Harbor replication dump
	resp, err := http.Get("https://artifacthub.io/api/v1/harbor-replication")
	if err != nil {
		return fmt.Errorf("failed to fetch Harbor replication dump: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch Harbor replication dump: status code %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	var packages []HarborPackage
	if err := json.Unmarshal(body, &packages); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	logger.Info(fmt.Sprintf("Found %d packages in Harbor replication dump", len(packages)))

	// Begin transaction
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Drop and recreate tables to ensure correct schema
	_, err = tx.Exec(ctx, `DROP TABLE IF EXISTS artifacthub_chart CASCADE`)
	if err != nil {
		return fmt.Errorf("failed to drop artifacthub_chart table: %w", err)
	}
	
	_, err = tx.Exec(ctx, `
		CREATE TABLE artifacthub_chart (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			version TEXT NOT NULL,
			content_url TEXT NOT NULL,
			repository TEXT NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			available BOOLEAN DEFAULT TRUE NOT NULL,
			verified BOOLEAN DEFAULT FALSE NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create artifacthub_chart table: %w", err)
	}

	_, err = tx.Exec(ctx, `DROP TABLE IF EXISTS artifacthub_meta CASCADE`)
	if err != nil {
		return fmt.Errorf("failed to drop artifacthub_meta table: %w", err)
	}

	_, err = tx.Exec(ctx, `
		CREATE TABLE artifacthub_meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create artifacthub_meta table: %w", err)
	}

	// Create indices if they don't exist
	_, err = tx.Exec(ctx, `
		CREATE INDEX artifacthub_chart_name_version_idx ON artifacthub_chart (name, version)
	`)
	if err != nil {
		return fmt.Errorf("failed to create name_version index: %w", err)
	}

	_, err = tx.Exec(ctx, `
		CREATE INDEX artifacthub_chart_name_idx ON artifacthub_chart (name)
	`)
	if err != nil {
		return fmt.Errorf("failed to create name index: %w", err)
	}

	// Insert new data
	batchSize := 1000
	inserted := 0
	
	// Use a map to deduplicate packages with the same name+version
	deduplicated := make(map[string]HarborPackage)
	for _, pkg := range packages {
		key := fmt.Sprintf("%s-%s", pkg.Package, pkg.Version)
		deduplicated[key] = pkg
	}
	
	// Convert back to slice for batch processing
	uniquePackages := make([]HarborPackage, 0, len(deduplicated))
	for _, pkg := range deduplicated {
		uniquePackages = append(uniquePackages, pkg)
	}
	
	// Group packages by name to get the latest version
	chartsByName := make(map[string][]HarborPackage)
	for _, pkg := range uniquePackages {
		chartsByName[pkg.Package] = append(chartsByName[pkg.Package], pkg)
	}
	
	if verbose {
		logger.Debug(fmt.Sprintf("Found %d unique chart names after deduplication", len(chartsByName)))
		logger.Debug(fmt.Sprintf("Processing %d unique packages (removed %d duplicates)", 
			len(uniquePackages), len(packages) - len(uniquePackages)))
	}
	
	// Process in batches to avoid memory issues
	for _, batch := range createBatches(uniquePackages, batchSize) {
		_, err = tx.CopyFrom(
			ctx,
			pgx.Identifier{"artifacthub_chart"},
			[]string{"id", "name", "version", "content_url", "repository"},
			pgx.CopyFromSlice(len(batch), func(i int) ([]interface{}, error) {
				pkg := batch[i]
				// Create a unique ID by combining package and version
				id := fmt.Sprintf("%s-%s", pkg.Package, pkg.Version)
				return []interface{}{
					id,
					pkg.Package,
					pkg.Version,
					pkg.URL,
					pkg.Repository,
				}, nil
			}),
		)
		
		if err != nil {
			return fmt.Errorf("failed to insert chart data batch: %w", err)
		}
		
		inserted += len(batch)
		if verbose {
			logger.Debug(fmt.Sprintf("Inserted %d/%d unique packages", inserted, len(uniquePackages)))
		}
	}

	// Update last updated timestamp
	now := time.Now().Format(time.RFC3339)
	_, err = tx.Exec(ctx, `
		INSERT INTO artifacthub_meta (key, value)
		VALUES ('last_updated', $1)
		ON CONFLICT ON CONSTRAINT artifacthub_meta_pkey DO UPDATE SET value = $1
	`, now)
	if err != nil {
		return fmt.Errorf("failed to update last updated timestamp: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	logger.Info(fmt.Sprintf("Successfully cached %d unique ArtifactHub charts", len(uniquePackages)))
	return nil
}

func createBatches(items []HarborPackage, batchSize int) [][]HarborPackage {
	var batches [][]HarborPackage
	
	for i := 0; i < len(items); i += batchSize {
		end := i + batchSize
		if end > len(items) {
			end = len(items)
		}
		batches = append(batches, items[i:end])
	}
	
	return batches
}