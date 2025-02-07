package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"errors"
)

type Chartsmith struct{}

func (m *Chartsmith) Validate(
	ctx context.Context,

	// +defaultPath="/"
	source *dagger.Directory,

	opServiceAccount *dagger.Secret,
) (bool, error) {
	allTestResults := map[string]*ValidateResult{}

	schemaResults, err := validateSchema(ctx, source)
	if err != nil {
		return false, err
	}
	allTestResults["schema"] = schemaResults

	unitTestResults, err := unitTestChartsmithApp(source, opServiceAccount)
	if err != nil {
		return false, err
	}
	allTestResults["unit-tests"] = unitTestResults

	functionalTestResults, err := functionalTests(source, opServiceAccount)
	if err != nil {
		return false, err
	}
	for name, result := range functionalTestResults {
		allTestResults[name] = result
	}

	for _, result := range allTestResults {
		if !result.Passed {
			return false, errors.New("one or more tests failed")
		}
	}

	return true, nil
}
