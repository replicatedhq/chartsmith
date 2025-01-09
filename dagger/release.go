package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
)

func (m *Chartsmith) Release(
	ctx context.Context,

	// +defaultPath="/"
	source *dagger.Directory,

	version string,
	githubToken *dagger.Secret,
	opServiceAccount *dagger.Secret,
) error {
	latestVersion, newVersion, err := processVersion(ctx, version, githubToken)
	if err != nil {
		return fmt.Errorf("processing version: %w", err)
	}

	fmt.Printf("Releasing %s -> %s\n", latestVersion, newVersion)

	if err := pushTag(ctx, source, githubToken, newVersion); err != nil {
		return err
	}

	stagingAccountID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Staging Push", "account_id")
	stagingAccessKeyID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Staging Push", "access_key_id")
	stagingSecretAccessKey := mustGetSecret(ctx, opServiceAccount, "Chartsmith - Staging Push", "secret_access_key")

	productionAccountID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Production Push", "account_id")
	productionAccessKeyID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Production Push", "access_key_id")
	productionSecretAccessKey := mustGetSecret(ctx, opServiceAccount, "Chartsmith - Production Push", "secret_access_key")

	// build all containers
	workerContainerStaging, workerContainerProd, err := buildWorker(ctx, source)
	if err != nil {
		return err
	}

	appContainerStaging, appContainerProd, err := buildChartsmithApp(ctx, source.Directory("chartsmith-app"), opServiceAccount, newVersion)
	if err != nil {
		return err
	}

	// publish all containers
	ref, err := pushContainer(ctx, workerContainerStaging, PushContainerOpts{
		Name:      "chartsmith-worker",
		Tag:       newVersion,
		AccountID: stagingAccountID,
		Region:    "us-east-1",

		AccessKeyID:     stagingAccessKeyID,
		SecretAccessKey: stagingSecretAccessKey,
	})
	if err != nil {
		return err
	}
	fmt.Printf("Pushed %s\n", ref)

	ref, err = pushContainer(ctx, workerContainerProd, PushContainerOpts{
		Name:      "chartsmith-worker",
		Tag:       newVersion,
		AccountID: productionAccountID,
		Region:    "us-east-1",

		AccessKeyID:     productionAccessKeyID,
		SecretAccessKey: productionSecretAccessKey,
	})
	if err != nil {
		return err
	}
	fmt.Printf("Pushed %s\n", ref)

	ref, err = pushContainer(ctx, appContainerStaging, PushContainerOpts{
		Name:      "chartsmith-app",
		Tag:       newVersion,
		AccountID: stagingAccountID,
		Region:    "us-east-1",

		AccessKeyID:     stagingAccessKeyID,
		SecretAccessKey: stagingSecretAccessKey,
	})
	if err != nil {
		return err
	}
	fmt.Printf("Pushed %s\n", ref)

	ref, err = pushContainer(ctx, appContainerProd, PushContainerOpts{
		Name:      "chartsmith-app",
		Tag:       newVersion,
		AccountID: productionAccountID,
		Region:    "us-east-1",

		AccessKeyID:     productionAccessKeyID,
		SecretAccessKey: productionSecretAccessKey,
	})
	if err != nil {
		return err
	}

	databaseFile := source.File("db/database.yaml")
	if err := pushYAMLToRepo(ctx, databaseFile, PushFileOpts{
		RepoFullName:    "replicatedcom/gitops-deploy",
		Branch:          "main",
		DestinationPath: "chartsmith/database.yaml",
		CommitMessage:   fmt.Sprintf("Update Chartsmith database to %s", newVersion),
		GithubToken:     githubToken,
	}); err != nil {
		return err
	}

	migrations := getChartsmithMigrations(ctx, source)
	if err := pushYAMLsToRepo(ctx, migrations, PushFileOpts{
		RepoFullName:    "replicatedcom/gitops-deploy",
		Branch:          "main",
		DestinationPath: "chartsmith/migrations.yaml",
		CommitMessage:   fmt.Sprintf("Update Chartsmith database to %s", newVersion),
		GithubToken:     githubToken,
	}); err != nil {
		return err
	}

	stagingHostname := fmt.Sprintf("%s.dkr.ecr.%s.amazonaws.com", stagingAccountID, "us-east-1")
	appImageName := fmt.Sprintf("%s/%s:%s", stagingHostname, "chartsmith-app", newVersion)
	workerImageName := fmt.Sprintf("%s/%s:%s", stagingHostname, "chartsmith-worker", newVersion)

	stagingEditedSource := dag.
		Kustomize().
		Edit(source, dagger.KustomizeEditOpts{
			Dir: "kustomize/overlays/staging",
		}).
		Set().
		Namespace("chartsmith").
		Set().
		Image(fmt.Sprintf("chartsmith-worker=%s", workerImageName)).
		Set().
		Image(fmt.Sprintf("chartsmith-app=%s", appImageName)).
		Directory()

	stagingManifests := dag.Kustomize().Build(
		stagingEditedSource,
		dagger.KustomizeBuildOpts{
			Dir: "kustomize/overlays/staging",
		},
	)

	if err := pushYAMLToRepo(ctx, stagingManifests, PushFileOpts{
		RepoFullName:    "replicatedcom/gitops-deploy",
		Branch:          "main",
		DestinationPath: "chartsmith/chartsmith.yaml",
		CommitMessage:   fmt.Sprintf("Update Chartsmith manifests to %s", newVersion),
		GithubToken:     githubToken,
	}); err != nil {
		return err
	}

	// productionMergedManifests := dag.
	// 	Kustomize().
	// 	Build(source, dagger.KustomizeBuildOpts{
	// 		Dir: "kustomize/overlays/production",
	// 	})
	// if err := pushYAMLToRepo(ctx, productionMergedManifests, PushFileOpts{
	// 	RepoFullName:    "replicatedcom/gitops-deploy",
	// 	Branch:          "release",
	// 	DestinationPath: "chartsmith.yaml",
	// 	CommitMessage:   fmt.Sprintf("Update Chartsmith manifests to %s", newVersion),
	// 	GithubToken:     githubToken,
	// }); err != nil {
	// 	return err
	// }

	// create a release on github
	if err := dag.Gh().
		WithToken(githubToken).
		WithRepo("replicatedhq/chartsmith").
		WithSource(source).
		Release().
		Create(ctx, newVersion, newVersion); err != nil {
		return err
	}

	return nil
}
