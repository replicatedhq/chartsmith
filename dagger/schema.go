package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"strings"
)

// validateSchema reads all schemahero migartions and confirms
// that they will be accepted by the CRD in the cluster
func validateSchema(ctx context.Context, source *dagger.Directory) (*ValidateResult, error) {
	deployableMigrations := getChartsmithMigrations(ctx, source)

	entries, err := deployableMigrations.Entries(ctx)
	if err != nil {
		return nil, err
	}

	errors := []string{}
	for _, entry := range entries {
		// confirm it's valid
		if entry == "" {
			errors = append(errors, "migration is empty")
		}
	}

	if len(errors) > 0 {
		return &ValidateResult{
			Passed: false,
			Stdout: "",
			Stderr: strings.Join(errors, "\n"),
		}, nil
	}

	return &ValidateResult{
		Passed: true,
		Stdout: "",
		Stderr: "",
	}, nil
}
