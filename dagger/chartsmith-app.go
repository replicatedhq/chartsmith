package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
	"strings"
	"time"
)

func lintChartsmithApp(
	source *dagger.Directory,
	opServiceAccount *dagger.Secret,
) (*ValidateResult, error) {
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

func unitTestChartsmithApp(
	source *dagger.Directory,
	opServiceAccount *dagger.Secret,
) (*ValidateResult, error) {
	buildContainer := buildEnvChartsmithApp(source, opServiceAccount)

	testContainer := buildContainer.WithExec([]string{"npm", "run", "test:unit"})

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

func buildChartsmithApp(ctx context.Context, source *dagger.Directory, opServiceAccount *dagger.Secret, version string) (*dagger.Container, error) {
	source = updateDebugPage(ctx, source, version)

	nodeModulesCache := dag.CacheVolume("chartsmith-node-modules")

	baseBuildContainer := buildEnvChartsmithApp(source, opServiceAccount).
		WithMountedCache("/src/node_modules", nodeModulesCache).
		WithExec([]string{"npm", "ci"})

	container := baseBuildContainer.
		WithExec([]string{"npm", "run", "build"})

	stdout, err := container.Stdout(ctx)
	if err != nil {
		return nil, fmt.Errorf("build error: %w", err)
	}
	fmt.Printf("Build container stdout:\n%s\n", stdout)

	standalone := container.Directory("/src/.next/standalone")
	static := container.Directory("/src/.next/static")
	standalone = standalone.WithDirectory("/.next/static", static)

	result := dag.Container(dagger.ContainerOpts{
		Platform: dagger.Platform("linux/amd64"),
	}).From("node:18").
		WithDirectory("/app", standalone).
		WithWorkdir("/").
		WithEnvVariable("HOSTNAME", "0.0.0.0").
		WithEntrypoint([]string{"node"}).
		WithDefaultArgs([]string{"/app/server.js"})

	return result, nil
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
		WithExec([]string{"npm", "install"})
}

func updateDebugPage(ctx context.Context, source *dagger.Directory, version string) *dagger.Directory {
	// Read the contents of the debug page file
	debugFile, err := source.File("app/debug/page.tsx").Contents(ctx)
	if err != nil {
		panic(err)
	}

	// Find the block of text between BEGIN AUTOMATED REPLACE and END AUTOMATED REPLACE
	begin := strings.Index(debugFile, "// BEGIN AUTOMATED REPLACE")
	end := strings.Index(debugFile, "// END AUTOMATED REPLACE")

	if begin == -1 || end == -1 || begin > end {
		panic("could not find begin and end markers in debug page")
	}

	// Extract the part of the file before and after the automated replace block
	beforeBlock := debugFile[:begin]
	afterBlock := debugFile[end:]

	// Generate new content for the automated replace block with timezone
	replacement := fmt.Sprintf(`const DEPLOY_TIME: string = "%sZ";
const VERSION: string = "%s";`,
		time.Now().Format("2006-01-02T15:04:05"), version)

	// Reassemble the file with the updated constants
	updatedFile := beforeBlock + "// BEGIN AUTOMATED REPLACE\n" + replacement + "\n" + afterBlock

	// Create the new file in the source directory
	source = source.WithNewFile("app/debug/page.tsx", updatedFile)

	return source
}
