package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/replicatedhq/chartsmith/pkg/integration"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/testhelpers"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func TestData() *cobra.Command {
	cmd := &cobra.Command{
		Use:           "test-data",
		Short:         "Generate test data",
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
			ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer stop()

			if err := generateTestData(ctx); err != nil {
				return fmt.Errorf("failed to generate test data: %w", err)
			}
			return nil
		},
	}

	return cmd
}

func generateTestData(ctx context.Context) error {
	opts := testhelpers.CreatePostgresContainerOpts{
		InstallExtensions: true,
		CreateSchema:      true,
		StaticData:        false,
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

	if err := integration.IntegrationTestData_ChooseRelevantFilesForChatMessage(ctx); err != nil {
		return fmt.Errorf("failed to generate data: %w", err)
	}

	// dump the data from postgres
	if err := dumpData(ctx); err != nil {
		return fmt.Errorf("failed to dump data: %w", err)
	}

	return nil
}

func dumpData(ctx context.Context) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	tableColumns := map[string][]string{
		"workspace": {
			"id", "created_at", "last_updated_at", "name",
			"created_by_user_id", "created_type", "current_revision_number",
		},
		"workspace_chart": {
			"id", "workspace_id", "name", "revision_number",
		},
		"workspace_revision": {
			"workspace_id", "revision_number", "created_at", "plan_id",
			"created_by_user_id", "created_type", "is_complete", "is_rendered",
		},
		"workspace_file": {
			"id", "revision_number", "chart_id", "workspace_id",
			"file_path", "content", "embeddings",
		},
	}

	for table, columns := range tableColumns {
		// Create the .csv file
		csvFilename := fmt.Sprintf("./testdata/static-data/%s.csv", table)
		csvFile, err := os.Create(csvFilename)
		if err != nil {
			return fmt.Errorf("failed to create CSV file %s: %w", csvFilename, err)
		}

		// Copy data to CSV
		query := fmt.Sprintf(`
			COPY (
				SELECT %s FROM %s
			) TO STDOUT WITH CSV
		`, strings.Join(columns, ", "), table)

		_, err = conn.Conn().PgConn().CopyTo(ctx, csvFile, query)
		if err != nil {
			csvFile.Close()
			return fmt.Errorf("failed to copy data for table %s: %w", table, err)
		}
		csvFile.Close()

		// Create the .sql file
		sqlFilename := fmt.Sprintf("./testdata/static-data/%s.sql", table)
		sqlFile, err := os.Create(sqlFilename)
		if err != nil {
			return fmt.Errorf("failed to create SQL file %s: %w", sqlFilename, err)
		}

		// Write the COPY FROM statement
		copyStmt := fmt.Sprintf("COPY %s (%s)\nFROM '/docker-entrypoint-initdb.d/%s.csv'\nCSV;\n",
			table,
			strings.Join(columns, ", "),
			table)

		if _, err := sqlFile.WriteString(copyStmt); err != nil {
			sqlFile.Close()
			return fmt.Errorf("failed to write SQL for %s: %w", table, err)
		}
		sqlFile.Close()
	}

	return nil
}
