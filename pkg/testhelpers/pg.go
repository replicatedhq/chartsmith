package testhelpers

import (
	"bytes"
	"context"
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

	if err := filepath.Walk("testdata/data", func(path string, info os.FileInfo, err error) error {
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

	initScriptsMergedFile, err := os.CreateTemp("", "init-scripts-merged.sql")
	if err != nil {
		return nil, err
	}
	defer initScriptsMergedFile.Close()

	for _, initDatafile := range initDatafiles {
		// append to the merged file
		if err := os.WriteFile(initScriptsMergedFile.Name(), []byte(initDatafile+"\n"), 0644); err != nil {
			return nil, err
		}
	}

	pgContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("pgvector/pgvector:pg16"),
		postgres.WithInitScripts(initScriptsMergedFile.Name()),
		postgres.WithDatabase("test-db"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).WithStartupTimeout(10*time.Second)),
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
