package cmd

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/param"
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

			if err := runBootstrap(cmd.Context(), param.Get().PGURI, v.GetString("chart-dir"), v.GetBool("force")); err != nil {
				return fmt.Errorf("failed to bootstrap chart: %w", err)
			}

			return nil
		},
	}

	wd, err := os.Getwd()
	if err != nil {
		return nil
	}

	bootstrapCmd.Flags().String("chart-dir", filepath.Join(wd, "bootstrap-chart"), "Chart directory")
	bootstrapCmd.Flags().Bool("force", false, "Force bootstrap even if the directory is already bootstrapped")

	return bootstrapCmd
}

func runBootstrap(ctx context.Context, pgURI string, chartDir string, force bool) error {
	currentDirectoryHash, err := directoryHashDeterministic(chartDir)
	if err != nil {
		return fmt.Errorf("failed to hash chart directory: %w", err)
	}

	pgOpts := persistence.PostgresOpts{
		URI: pgURI,
	}
	if err := persistence.InitPostgres(pgOpts); err != nil {
		return fmt.Errorf("failed to initialize postgres connection: %w", err)
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `select value from bootstrap_meta where key = 'current_directory_hash'`
	row := conn.QueryRow(ctx, query)
	var lastDirectoryHash sql.NullString
	err = row.Scan(&lastDirectoryHash)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("failed to get last directory hash: %w", err)
	}

	if !force && lastDirectoryHash.Valid && lastDirectoryHash.String == currentDirectoryHash {
		fmt.Printf("Bootstrap directory hash is the same as last time, skipping bootstrap\n")
		return nil
	}

	fmt.Printf("Bootstrapping initial chart data from %s...\n", chartDir)

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
		filePath = strings.TrimPrefix(filePath, "/")

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

		embeddings, err := embedding.Embeddings(summary.Content)
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

	// store the current directory hash
	_, err = conn.Exec(ctx, `
        INSERT INTO bootstrap_meta (key, value)
        VALUES ('current_directory_hash', $1)
		ON CONFLICT (key) DO UPDATE SET value = $1
    `, currentDirectoryHash)
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
