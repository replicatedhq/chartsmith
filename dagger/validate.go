package main

import (
	"dagger/chartsmith/internal/dagger"
	"errors"
)

type Chartsmith struct{}

func (m *Chartsmith) Validate(
	// +defaultPath="/"
	source *dagger.Directory,

	opServiceAccount *dagger.Secret,
) (bool, error) {
	allTestResults := map[string]*ValidateResult{}

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
