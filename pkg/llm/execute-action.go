package llm

import (
	"context"
	"fmt"
	"strings"
	"time"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/diff"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type CreateWorkspaceFromArchiveAction struct {
	ArchivePath string `json:"archivePath"`
	ArchiveType string `json:"archiveType"` // New field: "helm" or "k8s"
}

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, contentStreamCh chan string, doneCh chan error) error {
	fmt.Printf("Starting ExecuteAction for path: %s\n", actionPlanWithPath.Path)

	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(executePlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	detailedPlanMessage := fmt.Sprintf("The Helm chart plan is: %s", plan.Description)
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanMessage)))

	if actionPlanWithPath.Action == "create" {
		createMessage := fmt.Sprintf("Create the file at %s", actionPlanWithPath.Path)
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(createMessage)))
	} else if actionPlanWithPath.Action == "update" {

		updateMessage := fmt.Sprintf(`The file at %s needs to be updated according to the plan.
Here is the current content between XML tags:

<current_content>
%s
</current_content>

CRITICAL INSTRUCTION: You MUST generate a unified diff patch in the standard format, but without line numbers (see instructions below).
NEVER return just the new value - this is incorrect and will be rejected.
Write out the changes similar to a unified diff like `+"`diff -U0`"+` would produce.

Make sure you include the first 2 lines with the file paths.
Don't include timestamps with the file paths.

Start each hunk of changes with a `+"`@@ ... @@`"+` line.
Don't include line numbers like `+"`diff -U0`"+` does.
The user's patch tool doesn't need them.

The user's patch tool needs CORRECT patches that apply cleanly against the current contents of the file!
Think carefully and make sure you include and mark all lines that need to be removed or changed as `+"-"+` lines.
Make sure you mark all new or modified lines with `+"+"+`.
Don't leave out any lines or the diff patch won't apply correctly.

Indentation matters in the diffs!

Start a new hunk for each section of the file that needs changes.

Only output hunks that specify changes with `+"`+"+` or `+"-"+` lines.
Skip any hunks that are entirely unchanging `+"` `"+` lines.

Output hunks in whatever order makes the most sense.
Hunks don't need to be in any particular order.

When editing a function, method, loop, etc use a hunk to replace the *entire* code block.
Delete the entire existing version with `+"`-"+` lines and then add a new, updated version with `+"`+"+` lines.
This will help you generate correct code and correct diffs.

To move code within a file, use 2 hunks: 1 to delete it from its current location, 1 to insert it in the new location.


Complete example of the REQUIRED format:
--- templates/deployment.yaml
+++ templates/deployment.yaml
@@ ... @@
-  replicaCount: 1
+  replicaCount: 3
@@ ... @@
-      cpu: 10m
-      memory: 128Mi
+      cpu: 20m
+      memory: 256Mi
@@ ... @@


Follow the instructions to provide the patch in proper <chartsmithArtifact> tags.`,
			actionPlanWithPath.Path, strings.TrimSpace(currentContent))

		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(updateMessage)))
	}

	fmt.Printf("Starting Anthropic stream for path: %s\n", actionPlanWithPath.Path)
	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_7Sonnet20250219),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})

	fullResponseWithTags := ""
	message := anthropic.Message{}

	fmt.Printf("Entering stream processing loop for path: %s\n", actionPlanWithPath.Path)
	streamStartTime := time.Now()
	lastUpdateTime := time.Now()

	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				lastUpdateTime = time.Now()

				fullResponseWithTags += delta.Text
				artifacts, err := parseArtifactsInResponse(fullResponseWithTags)
				if err != nil {
					fmt.Printf("Error parsing artifacts: %v\n", err)
				}

				for _, artifact := range artifacts {
					if artifact.Path == actionPlanWithPath.Path {

						reconstructor := diff.NewDiffReconstructor(currentContent, artifact.Content)
						reconstructedDiff, err := reconstructor.ReconstructDiff()
						if err != nil {
							continue
						}

						contentStreamCh <- reconstructedDiff
					}
				}
			}
		}

		// Check for potential stall
		if time.Since(lastUpdateTime) > 30*time.Second {
			fmt.Printf("WARNING: No updates for 30s on path: %s\n", actionPlanWithPath.Path)
		}
	}

	// Add timeout check for the overall stream
	if time.Since(streamStartTime) > 5*time.Minute {
		return fmt.Errorf("stream timed out after 5 minutes for path: %s", actionPlanWithPath.Path)
	}

	fmt.Printf("Stream completed after %v for path: %s\n", time.Since(streamStartTime), actionPlanWithPath.Path)

	if stream.Err() != nil {
		fmt.Printf("Stream error for path %s: %v\n", actionPlanWithPath.Path, stream.Err())
		doneCh <- stream.Err()
		return stream.Err()
	}

	fmt.Printf("Sending nil to doneCh for path: %s\n", actionPlanWithPath.Path)
	doneCh <- nil
	return nil
}

func (a *CreateWorkspaceFromArchiveAction) Execute(ctx context.Context) error {
	// Modify the execution logic to handle different archive types
	switch a.ArchiveType {
	case "helm":
		return handleHelmChart(ctx, a.ArchivePath)
	case "k8s":
		return handleK8sManifests(ctx, a.ArchivePath)
	default:
		return fmt.Errorf("unknown archive type: %s", a.ArchiveType)
	}
}

func handleHelmChart(ctx context.Context, archivePath string) error {
	// Existing helm chart handling logic
	// ...
	return nil
}

func handleK8sManifests(ctx context.Context, archivePath string) error {
	// New logic for handling Kubernetes manifests
	// ...
	return nil
}
