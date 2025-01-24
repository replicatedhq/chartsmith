package llm

import (
	"context"
	"fmt"
	"time"

	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, contentStreamCh chan string, doneCh chan error) error {
	fmt.Printf("ExecuteAction: %+v\n", actionPlanWithPath)

	time.Sleep(time.Second * 5)

	contentStreamCh <- "Hello, world!"
	doneCh <- nil

	return nil
}
