package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
)

func lintChartsmithApp(
	source *dagger.Directory,
	opServiceAccount *dagger.Secret,
) (*ValidateResult, error) {
	source = source.Directory("chartsmith-app")
	buildContainer := buildEnvChartsmithApp(source, opServiceAccount)

	lintContainer := buildContainer.WithExec([]string{"npm", "run", "build"})

	isSuccess := true
	stdout, err := lintContainer.Stdout(context.Background())
	if err != nil {
		isSuccess = false
	}

	stderr, err := lintContainer.Stderr(context.Background())
	if err != nil {
		isSuccess = false
	}

	return &ValidateResult{
		Passed: isSuccess,
		Stdout: stdout,
		Stderr: stderr,
	}, nil
}

func buildEnvChartsmithApp(source *dagger.Directory, opServiceAccount *dagger.Secret) *dagger.Container {
	cache := dag.CacheVolume("chartsmith-app")

	source = source.WithoutFile(".env.local")

	buildContainer := dag.Container(dagger.ContainerOpts{
		Platform: dagger.Platform("linux/amd64"),
	}).From("node:18")

	return buildContainer.
		WithDirectory("/src", source).
		WithWorkdir("/src").
		WithMountedCache("/src/node_modules", cache).
		WithExec([]string{"npm", "install"}).
		WithExec([]string{"npm", "run", "build"})
}
