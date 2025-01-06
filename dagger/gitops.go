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

func pushYAMLsToRepo(ctx context.Context, yamlFiles *dagger.Directory, opts PushFileOpts) error {
	// join all files into a single yaml file with --- separators

	merged := ""

	entries, err := yamlFiles.Entries(ctx)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		contents, err := yamlFiles.File(entry).Contents(ctx)
		if err != nil {
			return err
		}

		merged += fmt.Sprintf("---\n%s\n", contents)
	}

	yamlFile := dagger.Connect().Directory().WithNewFile("merged.yaml", merged).File("merged.yaml")

	return pushYAMLToRepo(ctx, yamlFile, opts)
}

func pushYAMLToRepo(ctx context.Context, yamlFile *dagger.File, opts PushFileOpts) error {
	client := dagger.Connect()

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
	stdout, err := container.WithExec([]string{
		"sh", "-c",
		fmt.Sprintf(`
            git clone https://oauth2:${GITHUB_TOKEN}@github.com/%s.git repo &&
            cd repo &&
            cp /tmp/file.yaml %s &&
            git add %s &&
            git commit -m "%s" &&
            git push origin %s
        `,
			opts.RepoFullName,
			opts.DestinationPath,
			opts.DestinationPath,
			opts.CommitMessage,
			opts.Branch,
		),
	}).Stdout(ctx)
	fmt.Printf("%s\n", stdout)

	return err
}
