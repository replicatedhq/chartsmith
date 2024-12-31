package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"

	onepassword "github.com/1password/onepassword-sdk-go"
)

const vaultUUID = "ikfulaksdrbqtjgybu2vkcggeu" // Developer Automation

func mustGetItemUUID(ctx context.Context, opServiceAccount *dagger.Secret, itemName string) string {
	opServiceAccountPlaintext, err := opServiceAccount.Plaintext(ctx)
	if err != nil {
		panic(err)
	}
	client, err := onepassword.NewClient(ctx,
		onepassword.WithServiceAccountToken(opServiceAccountPlaintext),
		onepassword.WithIntegrationInfo("Dagger Workflow", "v0.0.1"),
	)

	items, err := client.Items.ListAll(ctx, vaultUUID)
	if err != nil {
		panic(err)
	}

	for {
		item, err := items.Next()
		if err != nil {
			if err == onepassword.ErrorIteratorDone {
				panic(fmt.Errorf("item %s not found", itemName))
			}
			panic(err)
		}

		if item.Title == itemName {
			return item.ID
		}
	}
}

func mustGetSecret(ctx context.Context, opServiceAccount *dagger.Secret, itemName string, field string) *dagger.Secret {
	opItemUUID := mustGetItemUUID(ctx, opServiceAccount, itemName)

	opServiceAccountPlaintext, err := opServiceAccount.Plaintext(ctx)
	if err != nil {
		panic(err)
	}
	client, err := onepassword.NewClient(ctx,
		onepassword.WithServiceAccountToken(opServiceAccountPlaintext),
		onepassword.WithIntegrationInfo("Dagger Workflow", "v0.0.1"),
	)
	if err != nil {
		panic(err)
	}

	onePasswordURI := fmt.Sprintf("op://%s/%s/%s", vaultUUID, opItemUUID, field)
	item, err := client.Secrets.Resolve(context.Background(), onePasswordURI)
	if err != nil {
		panic(fmt.Errorf("failed to get field %s from item %s: %w", field, itemName, err))
	}

	return dagger.Connect().SetSecret(itemName, item)
}

func mustGetNonSensitiveSecret(ctx context.Context, opServiceAccount *dagger.Secret, itemName string, field string) string {
	opItemUUID := mustGetItemUUID(ctx, opServiceAccount, itemName)

	opServiceAccountPlaintext, err := opServiceAccount.Plaintext(ctx)
	if err != nil {
		panic(err)
	}
	client, err := onepassword.NewClient(ctx,
		onepassword.WithServiceAccountToken(opServiceAccountPlaintext),
		onepassword.WithIntegrationInfo("Dagger Workflow", "v0.0.1"),
	)

	onePasswordURI := fmt.Sprintf("op://%s/%s/%s", vaultUUID, opItemUUID, field)
	item, err := client.Secrets.Resolve(context.Background(), onePasswordURI)
	if err != nil {
		panic(fmt.Errorf("failed to get field %s from item %s: %w", field, itemName, err))
	}

	return item
}
