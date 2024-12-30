package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
)

type PushContainerOpts struct {
	Name      string
	Tag       string
	AccountID string
	Region    string

	AccessKeyID     string
	SecretAccessKey *dagger.Secret
}

func pushContainer(ctx context.Context, container *dagger.Container, opts PushContainerOpts) (string, error) {
	hostname := fmt.Sprintf("https://%s.dkr.ecr.%s.amazonaws.com", opts.AccountID, opts.Region)

	ref, err := container.
		WithRegistryAuth(hostname, opts.AccessKeyID, opts.SecretAccessKey).
		Publish(ctx, fmt.Sprintf("%s:%s", opts.Name, opts.Tag))
	if err != nil {
		return "", err
	}

	return ref, nil
}
