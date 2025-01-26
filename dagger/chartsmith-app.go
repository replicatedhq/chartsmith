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

func buildChartsmithApp(ctx context.Context, source *dagger.Directory, opServiceAccount *dagger.Secret, version string) (*dagger.Container, *dagger.Container, error) {
	source = updateDebugPage(ctx, source, version)

	buildContainer := buildEnvChartsmithApp(source, opServiceAccount)

	stagingBuildContainer := buildContainer.
		WithEnvVariable("NEXT_PUBLIC_GOOGLE_CLIENT_ID", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith Oauth Credentials", "client_id")).
		WithEnvVariable("NEXT_PUBLIC_GOOGLE_REDIRECT_URI", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith Oauth Credentials", "redirect_uri")).
		WithSecretVariable("TOKEN_ENCRYPTION", mustGetSecret(context.Background(), opServiceAccount, "Staging - Chartsmith", "token_encryption")).
		WithEnvVariable("NEXT_PUBLIC_CENTRIFUGO_ADDRESS", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith Centrifugo", "client_address")).
		WithEnvVariable("NEXT_PUBLIC_REPLICATED_REDIRECT_URI", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith", "replicated_redirect_uri")).
		WithExec([]string{"npm", "run", "build"})
	stdout, err := stagingBuildContainer.Stdout(context.Background())
	if err != nil {
		return nil, nil, err
	}

	fmt.Printf("Staging build container stdout:\n%s\n", stdout)
	stagingStandalone := stagingBuildContainer.Directory("/src/.next/standalone")
	stagingStatic := stagingBuildContainer.Directory("/src/.next/static")
	stagingStandalone = stagingStandalone.WithDirectory("/.next/static", stagingStatic)

	stagingReleaseContainer := dag.Container(dagger.ContainerOpts{
		Platform: dagger.Platform("linux/amd64"),
	}).From("node:18")
	stagingReleaseContainer = stagingReleaseContainer.WithDirectory("/app", stagingStandalone)
	stagingReleaseContainer = stagingReleaseContainer.WithWorkdir("/")
	stagingReleaseContainer = stagingReleaseContainer.WithEntrypoint([]string{
		"node",
	})
	stagingReleaseContainer = stagingReleaseContainer.WithDefaultArgs([]string{
		"/app/server.js",
	})
	stagingReleaseContainer = stagingReleaseContainer.WithNewFile("/app/.env.local", fmt.Sprintf(
		`NEXT_PUBLIC_GOOGLE_CLIENT_ID=%s
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=%s
NEXT_PUBLIC_CENTRIFUGO_ADDRESS=%s
TOKEN_ENCRYPTION=%s
NEXT_PUBLIC_REPLICATED_REDIRECT_URI=%s
`, mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith Oauth Credentials", "client_id"),
		mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith Oauth Credentials", "redirect_uri"),
		mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith Centrifugo", "client_address"),
		mustGetSecretAsPlaintext(context.Background(), opServiceAccount, "Staging - Chartsmith", "token_encryption"),
		mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Staging - Chartsmith", "replicated_redirect_uri"),
	))

	prodBuildContainer := buildContainer.
		WithEnvVariable("NEXT_PUBLIC_GOOGLE_CLIENT_ID", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Production - Chartsmith Oauth Credentials", "client_id")).
		WithEnvVariable("NEXT_PUBLIC_GOOGLE_REDIRECT_URI", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Production - Chartsmith Oauth Credentials", "redirect_uri")).
		WithEnvVariable("NEXT_PUBLIC_CENTRIFUGO_ADDRESS", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Production - Chartsmith Centrifugo", "client_address")).
		WithSecretVariable("TOKEN_ENCRYPTION", mustGetSecret(context.Background(), opServiceAccount, "Production - Chartsmith", "token_encryption")).
		WithEnvVariable("NEXT_PUBLIC_REPLICATED_REDIRECT_URI", mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Production - Chartsmith", "replicated_redirect_uri")).
		WithExec([]string{"npm", "run", "build"})
	stdout, err = stagingBuildContainer.Stdout(context.Background())
	if err != nil {
		return nil, nil, err
	}
	fmt.Printf("Staging build container stdout:\n%s\n", stdout)
	prodStandalone := prodBuildContainer.Directory("/src/.next/standalone")
	prodStatic := prodBuildContainer.Directory("/src/.next/static")
	prodStandalone = prodStandalone.WithDirectory("/.next/static", prodStatic)

	prodReleaseContainer := dag.Container(dagger.ContainerOpts{
		Platform: dagger.Platform("linux/amd64"),
	}).From("node:18")
	prodReleaseContainer = prodReleaseContainer.WithDirectory("/app", prodStandalone)
	prodReleaseContainer = prodReleaseContainer.WithWorkdir("/")
	prodReleaseContainer = prodReleaseContainer.WithEntrypoint([]string{
		"node",
	})
	prodReleaseContainer = prodReleaseContainer.WithDefaultArgs([]string{
		"/app/server.js",
	})
	prodReleaseContainer = stagingReleaseContainer.WithNewFile("/app/.env.local", fmt.Sprintf(
		`NEXT_PUBLIC_GOOGLE_CLIENT_ID=%s
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=%s
NEXT_PUBLIC_CENTRIFUGO_ADDRESS=%s
TOKEN_ENCRYPTION=%s
`, mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Production - Chartsmith Oauth Credentials", "client_id"),
		mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Production - Chartsmith Oauth Credentials", "redirect_uri"),
		mustGetNonSensitiveSecret(context.Background(), opServiceAccount, "Production - Chartsmith Centrifugo", "client_address"),
		mustGetSecretAsPlaintext(context.Background(), opServiceAccount, "Production - Chartsmith", "token_encryption"),
	))

	return stagingReleaseContainer, prodReleaseContainer, nil
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

	// Generate new content for the automated replace block
	replacement := fmt.Sprintf(`const DEPLOY_TIME: string = "%s";
const VERSION: string = "%s";`,
		time.Now().Format("2006-01-02 15:04:05"), version)

	// Reassemble the file with the updated constants
	updatedFile := beforeBlock + "// BEGIN AUTOMATED REPLACE\n" + replacement + "\n" + afterBlock

	// Create the new file in the source directory
	source = source.WithNewFile("app/debug/page.tsx", updatedFile)

	return source
}
