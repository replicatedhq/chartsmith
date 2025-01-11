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

func CreatePostgresContainer(ctx context.Context) (*PostgresContainer, error) {
	initDatafiles := []string{
		"testdata/01-extensions.sql",
		"testdata/02-fixtures.sql",
	}

	// for some reason, i need to put the testdata from the data into the fixtures file
	// or testcontainers acts like something is wrong. i don't know testcontainers
	// well enough, but also getting real tired or fighting it

	if err := filepath.Walk("testdata/gen-data", func(path string, info os.FileInfo, err error) error {
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

	fmt.Printf("running: %s\n", mergedFile.Name())

	pgContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("pgvector/pgvector:pg16"),
		postgres.WithInitScripts(mergedFile.Name()),
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
		return nil, err
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
