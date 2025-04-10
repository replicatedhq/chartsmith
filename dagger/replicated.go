package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
)

func createReplicatedRelease(
	ctx context.Context,
	source *dagger.Directory,
	version string,
	opServiceAccount *dagger.Secret,
) (int, error) {
	fmt.Printf("Releasing %s to Replicated\n", version)

	source = source.WithNewDirectory("/replicated-release")

	helmChartFilename := fmt.Sprintf("chartsmith-%s.tgz", version)

	helmChart := dag.Container().From("alpine/helm:latest").
		WithMountedDirectory("/source", source).
		WithWorkdir("/source/chart/chartsmith").
		WithExec([]string{"helm", "dependency", "update"}).
		WithExec([]string{"helm", "package", "--version", version, "--app-version", version, "."}).
		File(fmt.Sprintf("/source/chart/chartsmith/%s", helmChartFilename))

	source = source.WithFile(fmt.Sprintf("/replicated-release/chartsmith-%s.tgz", version), helmChart)

	plainManifests, err := source.Directory("replicated").Entries(ctx)
	if err != nil {
		return 0, err
	}

	manifests := map[string]string{}
	for _, manifest := range plainManifests {
		contents, err := source.File(fmt.Sprintf("/replicated/%s", manifest)).Contents(ctx)
		if err != nil {
			return 0, err
		}

		manifests[manifest] = contents
	}

	replicated := dag.Container().From("replicated/vendor-cli:latest").
		WithMountedDirectory("/source", source).
		WithFile(fmt.Sprintf("/replicated-release/%s", helmChartFilename), helmChart).
		WithWorkdir("/replicated-release")

	for filename, contents := range manifests {
		replicated = replicated.WithNewFile("/replicated-release/"+filename, contents)
	}

	serviceAccount := mustGetSecret(ctx, opServiceAccount, "ChartSmith - Replicated Service Account", "token")

	replicated = replicated.
		WithSecretVariable("REPLICATED_API_TOKEN", serviceAccount).
		WithExec([]string{"/replicated", "release", "create", "--app", "chartsmith", "--promote", "Unstable", "--yaml-dir", ".", "--version", version})

	stdout, err := replicated.Stdout(ctx)
	if err != nil {
		return 0, err
	}

	fmt.Println(stdout)

	stderr, err := replicated.Stderr(ctx)
	if err != nil {
		return 0, err
	}

	fmt.Println(stderr)

	return 0, nil
}
