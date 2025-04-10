package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
	"sync"
)

func buildAndPush(
	ctx context.Context,
	source *dagger.Directory,
	githubToken *dagger.Secret,
	opServiceAccount *dagger.Secret,
	newVersion string,
) error {
	stagingAccountID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Staging Push", "account_id")
	productionAccountID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Production Push", "account_id")

	stagingAccessKeyID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Staging Push", "access_key_id")
	stagingSecretAccessKey := mustGetSecret(ctx, opServiceAccount, "Chartsmith - Staging Push", "secret_access_key")

	productionAccessKeyID := mustGetNonSensitiveSecret(ctx, opServiceAccount, "Chartsmith - Production Push", "access_key_id")
	productionSecretAccessKey := mustGetSecret(ctx, opServiceAccount, "Chartsmith - Production Push", "secret_access_key")

	// build all containers
	workerContainerStaging, workerContainerProd, workerContainerSelfHosted, err := buildWorker(ctx, source)
	if err != nil {
		return err
	}

	appContainerStaging, appContainerProd, appContainerSelfHosted, err := buildChartsmithApp(ctx, source.Directory("chartsmith-app"), opServiceAccount, newVersion)
	if err != nil {
		return err
	}

	// push all containers in parallel to speed up the release
	wg := sync.WaitGroup{}
	wg.Add(6)

	go func() {
		defer wg.Done()

		// publish all containers
		fmt.Printf("Pushing worker container staging\n")
		ref, err := pushContainer(ctx, workerContainerStaging, PushContainerOpts{
			Name:      "chartsmith-worker",
			Tag:       newVersion,
			AccountID: stagingAccountID,
			Region:    "us-east-1",

			AccessKeyID:     stagingAccessKeyID,
			SecretAccessKey: stagingSecretAccessKey,
		})
		if err != nil {
			panic(err)
		}
		fmt.Printf("Pushed worker container staging: %s\n", ref)
	}()

	go func() {
		defer wg.Done()

		fmt.Printf("Pushing worker container production\n")
		ref, err := pushContainer(ctx, workerContainerProd, PushContainerOpts{
			Name:      "chartsmith-worker",
			Tag:       newVersion,
			AccountID: productionAccountID,
			Region:    "us-east-1",

			AccessKeyID:     productionAccessKeyID,
			SecretAccessKey: productionSecretAccessKey,
		})
		if err != nil {
			panic(err)
		}
		fmt.Printf("Pushed worker container production: %s\n", ref)
	}()

	go func() {
		defer wg.Done()

		fmt.Printf("Pushing worker container self-hosted\n")
		ref, err := pushContainer(ctx, workerContainerSelfHosted, PushContainerOpts{
			Name: "chartsmith-worker",
			Tag:  newVersion,
		})
		if err != nil {
			panic(err)
		}
		fmt.Printf("Pushed worker container self-hosted: %s\n", ref)
	}()

	go func() {
		defer wg.Done()

		fmt.Printf("Pushing app container staging\n")
		ref, err := pushContainer(ctx, appContainerStaging, PushContainerOpts{
			Name:      "chartsmith-app",
			Tag:       newVersion,
			AccountID: stagingAccountID,
			Region:    "us-east-1",

			AccessKeyID:     stagingAccessKeyID,
			SecretAccessKey: stagingSecretAccessKey,
		})
		if err != nil {
			panic(err)
		}
		fmt.Printf("Pushed app container staging: %s\n", ref)
	}()

	go func() {
		defer wg.Done()

		fmt.Printf("Pushing app container production\n")
		ref, err := pushContainer(ctx, appContainerProd, PushContainerOpts{
			Name:      "chartsmith-app",
			Tag:       newVersion,
			AccountID: productionAccountID,
			Region:    "us-east-1",

			AccessKeyID:     productionAccessKeyID,
			SecretAccessKey: productionSecretAccessKey,
		})
		if err != nil {
			panic(err)
		}
		fmt.Printf("Pushed app container production: %s\n", ref)
	}()

	go func() {
		defer wg.Done()

		fmt.Printf("Pushing app container self-hosted\n")
		ref, err := pushContainer(ctx, appContainerSelfHosted, PushContainerOpts{
			Name: "chartsmith-app",
			Tag:  newVersion,
		})
		if err != nil {
			panic(err)
		}
		fmt.Printf("Pushed app container self-hosted: %s\n", ref)
	}()

	wg.Wait()

	return nil
}
