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
	fmt.Printf("getECRAuth: %+v\n", opts)
	fmt.Printf("accessKeyID: %s\n", opts.AccessKeyID)
	secretAccessKeyPlaintext, err := opts.SecretAccessKey.Plaintext(ctx)
	if err != nil {
		return "", "", fmt.Errorf("failed to get secret access key: %w", err)
	}
	fmt.Printf("secretAccessKey: %s\n", secretAccessKeyPlaintext)
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

func pushContainer(ctx context.Context, container *dagger.Container, opts PushContainerOpts) (string, error) {
	if opts.AccountID != "" {
		return pushContainerECR(ctx, container, opts)
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

func pushContainerECR(ctx context.Context, container *dagger.Container, opts PushContainerOpts) (string, error) {
	hostname := fmt.Sprintf("%s.dkr.ecr.%s.amazonaws.com", opts.AccountID, opts.Region)
	fullImageName := fmt.Sprintf("%s/%s:%s", hostname, opts.Name, opts.Tag)

	username, password, err := getECRAuth(ctx, opts)
	if err != nil {
		return "", fmt.Errorf("failed to get ECR auth: %w", err)
	}

	fmt.Printf("Attempting to push to hostname: %s\n", hostname)
	fmt.Printf("Full image name: %s\n", fullImageName)

	client := dagger.Connect()
	secretPassword := client.SetSecret("ecr-password", password)

	fmt.Printf("opts: %+v\n", opts)
	ref, err := container.
		WithRegistryAuth(hostname, username, secretPassword).
		Publish(ctx, fullImageName)
	if err != nil {
		return "", fmt.Errorf("push failed: hostname=%s, image=%s, error=%w", hostname, fullImageName, err)
	}

	return ref, nil
}
