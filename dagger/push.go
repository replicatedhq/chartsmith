package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/ecr"
)

type PushContainerOpts struct {
	Name string
	Tag  string

	AccountID       string
	Region          string
	AccessKeyID     string
	SecretAccessKey *dagger.Secret

	DockerhubUsername string
	DockerhubPassword *dagger.Secret
}

func getECRAuth(ctx context.Context, opts PushContainerOpts) (string, string, error) {
	secretAccessKeyPlaintext, err := opts.SecretAccessKey.Plaintext(ctx)
	if err != nil {
		return "", "", fmt.Errorf("failed to get secret access key: %w", err)
	}
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(opts.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			opts.AccessKeyID,
			secretAccessKeyPlaintext,
			"", // No session token needed
		)),
	)
	if err != nil {
		return "", "", fmt.Errorf("unable to load SDK config: %w", err)
	}

	client := ecr.NewFromConfig(cfg)
	output, err := client.GetAuthorizationToken(ctx, &ecr.GetAuthorizationTokenInput{})
	if err != nil {
		return "", "", fmt.Errorf("unable to get auth token: %w", err)
	}

	if len(output.AuthorizationData) == 0 {
		return "", "", fmt.Errorf("no authorization data received")
	}

	authToken := *output.AuthorizationData[0].AuthorizationToken
	decodedToken, err := base64.StdEncoding.DecodeString(authToken)
	if err != nil {
		return "", "", fmt.Errorf("unable to decode auth token: %w", err)
	}

	parts := strings.SplitN(string(decodedToken), ":", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid auth token format")
	}

	return parts[0], parts[1], nil
}

func pushContainer(
	ctx context.Context,
	client *dagger.Client,
	cache map[string]ecrCredentials,
	container *dagger.Container,
	opts PushContainerOpts,
) (string, error) {
	if opts.AccountID != "" {
		creds, err := getCachedECRAuth(ctx, client, cache, opts)
		if err != nil {
			return "", err
		}
		return pushContainerECR(ctx, container, opts, creds)
	}

	return pushContainerDockerHub(ctx, container, opts)
}

func pushContainerDockerHub(ctx context.Context, container *dagger.Container, opts PushContainerOpts) (string, error) {
	fullImageName := fmt.Sprintf("chartsmith/%s:%s", opts.Name, opts.Tag)

	fmt.Printf("opts: %+v\n", opts)
	hostname := "index.docker.io"
	ref, err := container.
		WithRegistryAuth(hostname, opts.DockerhubUsername, opts.DockerhubPassword).
		Publish(ctx, fullImageName)
	if err != nil {
		return "", fmt.Errorf("push failed: hostname=%s, image=%s, error=%w", hostname, fullImageName, err)
	}

	return ref, nil
}

func pushContainerECR(ctx context.Context, container *dagger.Container, opts PushContainerOpts, creds ecrCredentials) (string, error) {
	fullImageName := fmt.Sprintf("%s/%s:%s", creds.Hostname, opts.Name, opts.Tag)

	ref, err := container.
		WithRegistryAuth(creds.Hostname, creds.Username, creds.Password).
		Publish(ctx, fullImageName)
	if err != nil {
		return "", fmt.Errorf("push failed: hostname=%s, image=%s, error=%w", creds.Hostname, fullImageName, err)
	}

	return ref, nil
}

type ecrCredentials struct {
	Username string
	Password *dagger.Secret
	Hostname string
}

func getCachedECRAuth(ctx context.Context, client *dagger.Client, cache map[string]ecrCredentials, opts PushContainerOpts) (ecrCredentials, error) {
	cacheKey := fmt.Sprintf("%s:%s", opts.AccountID, opts.Region)
	if creds, ok := cache[cacheKey]; ok {
		return creds, nil
	}

	username, password, err := getECRAuth(ctx, opts)
	if err != nil {
		return ecrCredentials{}, fmt.Errorf("failed to get ECR auth: %w", err)
	}

	hostname := fmt.Sprintf("%s.dkr.ecr.%s.amazonaws.com", opts.AccountID, opts.Region)
	secretPassword := client.SetSecret("ecr-password-"+opts.AccountID, password)

	creds := ecrCredentials{
		Username: username,
		Password: secretPassword,
		Hostname: hostname,
	}

	cache[cacheKey] = creds
	return creds, nil
}
