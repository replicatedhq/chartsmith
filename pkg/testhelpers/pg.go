package testhelpers

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

type PostgresContainer struct {
	*postgres.PostgresContainer
	ConnectionString string
	Logs             *bytes.Buffer
}

type CreatePostgresContainerOpts struct {
	InstallExtensions bool
	CreateSchema      bool
	StaticData        bool
}

func CreatePostgresContainer(ctx context.Context, opts CreatePostgresContainerOpts) (*PostgresContainer, error) {
	initDatafiles := []string{}

	if opts.InstallExtensions {
		initDatafiles = append(initDatafiles, "testdata/01-extensions.sql")
	}

	if opts.CreateSchema {
		initDatafiles = append(initDatafiles, "testdata/02-fixtures.sql")
	}

	if opts.StaticData {
		if err := filepath.Walk("testdata/static-data", func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}
			if filepath.Ext(path) == ".sql" {
				// make sure it's not already there
				initDatafiles = append(initDatafiles, path)
			}
			return nil
		}); err != nil {
			return nil, err
		}
	}

	mergedFilename := filepath.Join("testdata", "init-scripts-merged.sql")
	if _, err := os.Stat(mergedFilename); err == nil {
		if err := os.Remove(mergedFilename); err != nil {
			return nil, err
		}
	}

	mergedFile, err := os.Create(mergedFilename)
	if err != nil {
		return nil, err
	}
	defer mergedFile.Close()

	for _, initDatafile := range initDatafiles {
		b, err := os.ReadFile(initDatafile)
		if err != nil {
			return nil, err
		}
		if _, err := mergedFile.Write(b); err != nil {
			return nil, err
		}
		if _, err := mergedFile.WriteString("\n"); err != nil {
			return nil, err
		}
	}
	mergedFile.Close()

	csvFilenames := []string{}
	if opts.StaticData {
		if err := filepath.Walk("testdata/static-data", func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}
			if filepath.Ext(path) == ".csv" {
				csvFilenames = append(csvFilenames, path)
			}
			return nil
		}); err != nil {
			return nil, err
		}
	}

	initScripts := []string{mergedFile.Name()}
	for _, csvFilename := range csvFilenames {
		initScripts = append(initScripts, csvFilename)
	}

	pgContainer, err := postgres.Run(ctx,
		"pgvector/pgvector:pg16",
		postgres.WithInitScripts(initScripts...),
		postgres.WithDatabase("test-db"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		testcontainers.WithWaitStrategy(
			wait.
				ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(10*time.Second)),
	)
	if err != nil {
		// Capture logs before returning error
		logReader, logErr := pgContainer.Logs(ctx)
		if logErr != nil {
			return nil, fmt.Errorf("container failed: %v (failed to get logs: %v)", err, logErr)
		}
		defer logReader.Close()

		logs := new(bytes.Buffer)
		if _, err := logs.ReadFrom(logReader); err != nil {
			return nil, fmt.Errorf("container failed: %v (failed to read logs: %v)", err, err)
		}
		return nil, fmt.Errorf("container failed: %v\nLogs:\n%s", err, logs.String())
	}
	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		return nil, err
	}

	return &PostgresContainer{
		PostgresContainer: pgContainer,
		ConnectionString:  connStr,
	}, nil
}
