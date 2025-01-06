package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
	"path/filepath"
	"strings"
)

func getChartsmithMigrations(
	ctx context.Context,

	// +defaultPath="/"
	source *dagger.Directory,

) *dagger.Directory {
	// create an empty directory
	kubernetesMigrations := dagger.Connect().Directory()

	tableMigrations := getTableMigrations(ctx, source)

	// copy all files into the kubernetes migrations directory
	tableMigrationFiles, err := tableMigrations.Entries(ctx)
	if err != nil {
		panic(err)
	}
	for _, file := range tableMigrationFiles {
		kubernetesMigrations = kubernetesMigrations.WithFile(file, tableMigrations.File(file))
	}

	return kubernetesMigrations
}

func getTableMigrations(ctx context.Context, source *dagger.Directory) *dagger.Directory {
	// We need to add the K8s yaml envelope to the migrations
	source = source.Directory("db/schema/tables")

	tableMigrations := dagger.Connect().Directory()

	entries, err := source.Entries(ctx)
	if err != nil {
		panic(err)
	}

	for _, file := range entries {
		fmt.Printf("Adding migration %s\n", file)

		contents, err := source.File(file).Contents(ctx)
		if err != nil {
			panic(err)
		}

		baseName := filepath.Base(file)
		ext := filepath.Ext(baseName)
		nameWithoutExt := strings.TrimSuffix(baseName, ext)

		indentedContents := indentString(contents, "  ")

		content := fmt.Sprintf(`apiVersion: schemas.schemahero.io/v1alpha4
kind: Table
metadata:
  name: %s
  namespace: chartsmith
spec:
%s`, nameWithoutExt, indentedContents)

		tableMigrations = tableMigrations.WithNewFile(file, strings.TrimSpace(content))
	}

	return tableMigrations
}

func indentString(s, prefix string) string {
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		lines[i] = prefix + line
	}
	return strings.Join(lines, "\n")
}
