package main

import (
	"dagger/chartsmith/internal/dagger"
)

func functionalTests(source *dagger.Directory, opServiceAccount *dagger.Secret) (map[string]*ValidateResult, error) {
	stepResults := map[string]*ValidateResult{}

	chartsmithUnitTestResults, err := testWorker(source)
	if err != nil {
		return nil, err
	}
	stepResults["chartsmith_unit_tests"] = chartsmithUnitTestResults

	chartsmithAppLintResults, err := lintChartsmithApp(source, opServiceAccount)
	if err != nil {
		return nil, err
	}
	stepResults["chartsmith_app_lint"] = chartsmithAppLintResults

	return stepResults, nil
}
