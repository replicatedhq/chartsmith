package cmd

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	yaml "gopkg.in/yaml.v2"
)

func BootstrapCmd() *cobra.Command {
	bootstrapCmd := &cobra.Command{
		Use:   "bootstrap",
		Short: "Bootstrap the initial workspace data",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()
			if err := v.BindPFlags(cmd.Flags()); err != nil {
				return fmt.Errorf("failed to bind flags: %w", err)
			}

			sess, err := session.NewSession(aws.NewConfig().WithCredentialsChainVerboseErrors(true))
			if err != nil {
				// previous use of session.New did not fail on error
				// we have not yet initialized logging, so we cannot use saaskit/log
				fmt.Printf("Failed to create aws session: %v\n", err)
			}

			if err := param.Init(sess); err != nil {
				return fmt.Errorf("failed to init params: %w", err)
			}

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			v := viper.GetViper()

			if err := runBootstrap(cmd.Context(), param.Get().PGURI, v.GetString("workspace-dir"), v.GetBool("force")); err != nil {
				return fmt.Errorf("failed to bootstrap workspace: %w", err)
			}

			return nil
		},
	}

	wd, err := os.Getwd()
	if err != nil {
		return nil
	}

	bootstrapCmd.Flags().String("workspace-dir", filepath.Join(wd, "bootstrap", "default-workspace"), "Workspace directory")
	bootstrapCmd.Flags().Bool("force", false, "Force bootstrap even if the directory is already bootstrapped")

	return bootstrapCmd
}

func runBootstrap(ctx context.Context, pgURI string, workspaceDir string, force bool) error {
	// let's generate an ID for this bootstrap workspace, how about using a hash of the workspace dir string?
	workspaceID := hashString(workspaceDir)
	workspaceName := filepath.Base(workspaceDir)

	currentDirectoryHash, err := directoryHashDeterministic(workspaceDir)
	if err != nil {
		return fmt.Errorf("failed to hash workspace directory: %w", err)
	}

	pgOpts := persistence.PostgresOpts{
		URI: pgURI,
	}
	if err := persistence.InitPostgres(pgOpts); err != nil {
		return fmt.Errorf("failed to initialize postgres connection: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// since we do want to support multiple bootstrap workspaces, we generate a key for each

	query := `select value from bootstrap_meta where key = 'current_directory_hash' and workspace_id = $1`
	row := conn.QueryRow(ctx, query, workspaceID)
	var lastDirectoryHash sql.NullString
	err = row.Scan(&lastDirectoryHash)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("failed to get last directory hash: %w", err)
	}

	if !force && lastDirectoryHash.Valid && lastDirectoryHash.String == currentDirectoryHash {
		fmt.Printf("Bootstrap directory hash is the same as last time, skipping bootstrap\n")
		return nil
	}

	fmt.Printf("Bootstrapping initial workspace data from %s...\n", workspaceDir)

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// remove existing files
	_, err = tx.Exec(ctx, "DELETE FROM bootstrap_file where workspace_id = $1", workspaceID)
	if err != nil {
		return fmt.Errorf("failed to delete files: %w", err)
	}

	// remove existing charts
	_, err = tx.Exec(ctx, "DELETE FROM bootstrap_chart where workspace_id = $1", workspaceID)
	if err != nil {
		return fmt.Errorf("failed to delete charts: %w", err)
	}

	_, err = tx.Exec(ctx, "INSERT INTO bootstrap_workspace (id, name, current_revision) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, current_revision = EXCLUDED.current_revision", workspaceID, workspaceName, 0)
	if err != nil {
		return fmt.Errorf("failed to insert workspace: %w", err)
	}

	_, err = tx.Exec(ctx, "INSERT INTO bootstrap_revision (workspace_id, revision_number, is_complete) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, revision_number) DO UPDATE SET is_complete = EXCLUDED.is_complete", workspaceID, 0, true)
	if err != nil {
		return fmt.Errorf("failed to insert revision: %w", err)
	}

	charts := []string{}
	chartsDir := filepath.Join(workspaceDir, "charts")

	entries, err := os.ReadDir(chartsDir)
	if err != nil {
		return fmt.Errorf("failed to read charts directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			charts = append(charts, filepath.Join(chartsDir, entry.Name()))
		}
	}

	// for each chart in charts, walk and insert the files
	for _, chart := range charts {
		fmt.Printf("Processing chart %s...\n", chart)

		chartID := hashString(chart)
		chartName := ""

		// walk the chart directory and insert files
		err = filepath.Walk(chart, func(path string, info os.FileInfo, err error) error {
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

			relativePath := strings.TrimPrefix(path, chart)
			relativePath = strings.TrimPrefix(relativePath, string(os.PathSeparator))

			if relativePath == "Chart.yaml" {
				// parse and get the chart name
				n, err := parseChartName(string(content))
				if err != nil {
					return fmt.Errorf("failed to parse chart name: %w", err)
				}
				chartName = n
			}
			fmt.Printf("embedding %s...\n", relativePath)
			embeddings, err := embedding.Embeddings(string(content))
			if err != nil {
				return fmt.Errorf("failed to get embeddings: %w", err)
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO bootstrap_file (id, chart_id, workspace_id, file_path, content, embeddings)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, hashString(relativePath), chartID, workspaceID, relativePath, content, embeddings)
			if err != nil {
				return fmt.Errorf("failed to insert file: %w", err)
			}

			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to insert chart files: %w", err)
		}

		_, err := tx.Exec(ctx, `
            INSERT INTO bootstrap_chart (id, workspace_id, name)
            VALUES ($1, $2, $3)
        `, chartID, workspaceID, chartName)
		if err != nil {
			return fmt.Errorf("failed to insert chart: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// store the current directory hash
	_, err = conn.Exec(ctx, `
        INSERT INTO bootstrap_meta (key, value, workspace_id)
        VALUES ('current_directory_hash', $1, $2)
		ON CONFLICT (key, workspace_id) DO UPDATE SET value = $1
    `, currentDirectoryHash, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to store current directory hash: %w", err)
	}

	return nil
}

func directoryHashDeterministic(path string) (string, error) {
	var files []string
	err := filepath.Walk(path, func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relPath, err := filepath.Rel(path, filePath)
		if err != nil {
			return err
		}
		if relPath != "." {
			files = append(files, relPath)
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("failed to walk directory: %w", err)
	}

	// Sort files for deterministic ordering
	sort.Strings(files)

	hasher := sha256.New()
	for _, relPath := range files {
		filePath := filepath.Join(path, relPath)
		info, err := os.Stat(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to stat file %s: %w", filePath, err)
		}

		// Hash the relative path
		if _, err := hasher.Write([]byte(relPath)); err != nil {
			return "", fmt.Errorf("failed to hash path: %w", err)
		}

		// If it's a regular file, hash its contents
		if info.Mode().IsRegular() {
			file, err := os.Open(filePath)
			if err != nil {
				return "", fmt.Errorf("failed to open file %s: %w", filePath, err)
			}

			if _, err := io.Copy(hasher, file); err != nil {
				file.Close()
				return "", fmt.Errorf("failed to hash file %s: %w", filePath, err)
			}
			file.Close()
		}

		// Hash file metadata
		modeBytes := []byte(fmt.Sprintf("%v", info.Mode()))
		sizeBytes := []byte(fmt.Sprintf("%d", info.Size()))

		if _, err := hasher.Write(modeBytes); err != nil {
			return "", fmt.Errorf("failed to hash file mode: %w", err)
		}
		if _, err := hasher.Write(sizeBytes); err != nil {
			return "", fmt.Errorf("failed to hash file size: %w", err)
		}
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func hashString(s string) string {
	h := fnv.New32a()
	h.Write([]byte(s))
	return fmt.Sprintf("%04x", uint16(h.Sum32()))
}

func parseChartName(chartYAML string) (string, error) {
	var chart struct {
		Name string `yaml:"name"`
	}

	err := yaml.Unmarshal([]byte(chartYAML), &chart)
	if err != nil {
		return "", fmt.Errorf("failed to parse chart.yaml: %w", err)
	}

	return chart.Name, nil
}
