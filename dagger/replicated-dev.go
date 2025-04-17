package main

import (
	"context"
	"dagger/chartsmith/internal/dagger"
	"fmt"
)

func (m *Chartsmith) ReleaseDevReplicated(
	ctx context.Context,

	// +defaultPath="/"
	source *dagger.Directory,

	version string,

	endpoint string,

	apiToken *dagger.Secret,
) error {
	releaseSequence, err := createReplicatedReleaseDev(ctx, source, version, endpoint, apiToken)
	if err != nil {
		return err
	}

	fmt.Printf("Replicated release sequence: %d\n", releaseSequence)

	return nil
}
