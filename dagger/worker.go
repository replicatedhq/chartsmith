package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
)

func buildWorker(ctx context.Context, source *dagger.Directory) (*dagger.Container, *dagger.Container, error) {
	binary := buildEnvWorker(source).
		WithExec([]string{"make", "build"}).
		File("bin/chartsmith-worker")

	// build a wolfi container
	releaseContainer := buildEnvWorker(source).
		WithFile("/chartsmith-worker", binary)

	// add the bootstrap chart in so that our init container can use it
	releaseContainer = releaseContainer.WithDirectory("/chart", source.Directory("bootstrap-chart"))

	releaseContainer = releaseContainer.WithEntrypoint([]string{
		"/chartsmith-worker",
	})

	return releaseContainer, releaseContainer, nil
}

func testWorker(source *dagger.Directory) (*ValidateResult, error) {
	testContainer := buildEnvWorker(source).
		WithExec([]string{"make", "test"})

	isSuccess := true
	stdout, err := testContainer.Stdout(context.Background())
	if err != nil {
		isSuccess = false
	}

	stderr, err := testContainer.Stderr(context.Background())
	if err != nil {
		isSuccess = false
	}

	return &ValidateResult{
		Passed: isSuccess,
		Stdout: stdout,
		Stderr: stderr,
	}, nil
}

func buildEnvWorker(source *dagger.Directory) *dagger.Container {
	// exclude some directories
	source = source.WithoutDirectory("dagger")
	source = source.WithoutDirectory("hack")
	source = source.WithoutDirectory("db")
	source = source.WithoutDirectory("chartsmith-app")

	cache := dag.CacheVolume("chartsmith-worker")

	buildContainer := dag.Container(dagger.ContainerOpts{
		Platform: dagger.Platform("linux/amd64"),
	}).From("golang:1.23")

	return buildContainer.
		WithDirectory("/go/src/github.com/replicatedhq/chartsmith", source).
		WithWorkdir("/go/src/github.com/replicatedhq/chartsmith").
		WithMountedCache("/go/pkg/mod", cache).
		WithEnvVariable("GOMODCACHE", "/go/pkg/mod").
		WithMountedCache("/go/build-cache", cache).
		WithEnvVariable("GOCACHE", "/go/build-cache").
		WithExec([]string{"go", "mod", "download"})
}
