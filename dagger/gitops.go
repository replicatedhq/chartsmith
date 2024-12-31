package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
)

type PushFileOpts struct {
	RepoFullName    string // "org/repo"
	Branch          string // e.g. "main"
	DestinationPath string // where to put the file in the repo
	CommitMessage   string // commit message
	GithubToken     *dagger.Secret
}

func pushYAMLToRepo(ctx context.Context, yamlFile *dagger.File, opts PushFileOpts) error {
	client := dagger.Connect()

	// Create a container with git and necessary tools
	container := client.Container().
		From("alpine/git").
		WithMountedFile("/tmp/file.yaml", yamlFile).
		WithEnvVariable("GIT_AUTHOR_NAME", "Chartsmith Dagger").
		WithEnvVariable("GIT_AUTHOR_EMAIL", "release@replicatred.com").
		WithEnvVariable("GIT_COMMITTER_NAME", "Chartsmith Dagger").
		WithEnvVariable("GIT_COMMITTER_EMAIL", "release@replicatred.com")

	// Set up Git with credentials
	container = container.WithSecretVariable("GITHUB_TOKEN", opts.GithubToken)

	// Clone, add file, commit and push
	_, err := container.WithExec([]string{
		"sh", "-c",
		fmt.Sprintf(`
            git clone https://oauth2:${GITHUB_TOKEN}@github.com/%s.git repo &&
            cd repo &&
            cp /tmp/file.yaml %s &&
            git add %s &&
            git commit -m "%s" &&
            git push origin %s
        `,
			opts.RepoFullName,    // e.g. "org/repo"
			opts.DestinationPath, // where to put the file in the repo
			opts.DestinationPath, // file to add
			opts.CommitMessage,   // commit message
			opts.Branch,          // branch name
		),
	}).Sync()

	return err
}
