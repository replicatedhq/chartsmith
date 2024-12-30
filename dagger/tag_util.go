package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func pushTag(ctx context.Context, source *dagger.Directory, githubToken *dagger.Secret, newVersion string) error {
	err := tryPushTag(ctx, source, githubToken, newVersion)
	if err == nil {
		return nil
	}

	if strings.Contains(err.Error(), "tag already exists in the remote") {
		fmt.Printf("Tag already exists, deleting and pushing again\n")
		err = deleteTag(ctx, source, githubToken, newVersion)
		if err != nil {
			return err
		}

		return tryPushTag(ctx, source, githubToken, newVersion)
	}

	return nil
}

func tryPushTag(ctx context.Context, source *dagger.Directory, githubToken *dagger.Secret, newVersion string) error {
	// push the tag
	githubTokenPlaintext, err := githubToken.Plaintext(ctx)
	if err != nil {
		return err
	}
	tagContainer := dag.Container().
		From("alpine/git:latest").
		WithMountedDirectory("/go/src/github.com/replicatedhq/chartsmith", source).
		WithWorkdir("/go/src/github.com/replicatedhq/chartsmith").
		WithExec([]string{"git", "remote", "add", "tag", fmt.Sprintf("https://%s@github.com/replicatedhq/chartsmith.git", githubTokenPlaintext)}).
		WithExec([]string{"git", "tag", newVersion}).
		WithExec([]string{"git", "push", "tag", newVersion})
	_, err = tagContainer.Stdout(ctx)
	if err != nil {
		return err
	}

	return nil
}

func deleteTag(ctx context.Context, source *dagger.Directory, githubToken *dagger.Secret, tag string) error {
	fmt.Printf("Deleting tag %s\n", tag)
	// push the tag
	githubTokenPlaintext, err := githubToken.Plaintext(ctx)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("DELETE", fmt.Sprintf("https://api.github.com/repos/replicatedhq/chartsmith/git/refs/tags/%s", tag), nil)
	if err != nil {
		return err
	}
	req.Header.Add("Authorization", fmt.Sprintf("token %s", githubTokenPlaintext))
	req.Header.Add("Accept", "application/vnd.github.v3+json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	time.Sleep(time.Second * 10)
	return nil
}
