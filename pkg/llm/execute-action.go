package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

type CreateWorkspaceFromArchiveAction struct {
	ArchivePath string `json:"archivePath"`
	ArchiveType string `json:"archiveType"` // New field: "helm" or "k8s"
}

func ExecuteAction(ctx context.Context, actionPlanWithPath llmtypes.ActionPlanWithPath, plan *workspacetypes.Plan, currentContent string, contentStreamCh chan string, doneCh chan error) error {
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

CRITICAL INSTRUCTION: You MUST generate a complete unified diff patch in the standard format.
NEVER return just the new value - this is incorrect and will be rejected.

The patch MUST contain ALL of these elements in this EXACT order:

1. File headers (both lines required):
   --- %[1]s
   +++ %[1]s

2. Hunk header showing line numbers:
   @@ -lineNum,lineCount +lineNum,lineCount @@

3. Context and changes:
   - Three (3) lines of unchanged context BEFORE the change (no leading spaces)
   - The removed line with "-" prefix
   - The added line with "+" prefix
   - Three (3) lines of unchanged context AFTER the change (no leading spaces)

Complete example of the REQUIRED format:
--- %[1]s
+++ %[1]s
@@ -5,7 +5,7 @@
# First context line
# Second context line
# Third context line
-replicaCount: 1
+replicaCount: 3
# Fourth context line
# Fifth context line
# Sixth context line

IMPORTANT:
- Context lines must NOT have leading spaces
- Only added lines ("+") and removed lines ("-") should have a prefix
- The patch must exactly match this format

Follow the instructions to provide the patch in proper <chartsmithArtifact> tags.`,
			actionPlanWithPath.Path, strings.TrimSpace(currentContent))

		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(updateMessage)))
	}

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.ModelClaude3_5Sonnet20241022),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})

	fullResponseWithTags := ""

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				fullResponseWithTags += delta.Text
				artifacts, err := parseArtifactsInResponse(fullResponseWithTags)
				if err != nil {
					return fmt.Errorf("error parsing artifacts in response: %w", err)
				}

				for _, artifact := range artifacts {
					if artifact.Path == actionPlanWithPath.Path {
						// Validate patch format before sending
						lines := strings.Split(artifact.Content, "\n")
						if len(lines) < 4 {
							continue
						}

						// Must start with proper headers
						if !strings.HasPrefix(lines[0], "--- "+actionPlanWithPath.Path) ||
							!strings.HasPrefix(lines[1], "+++ "+actionPlanWithPath.Path) {
							continue
						}

						// Must have a hunk header
						hasHunk := false
						for _, line := range lines[2:] {
							if strings.HasPrefix(line, "@@") {
								hasHunk = true
								break
							}
						}
						if !hasHunk {
							continue
						}

						contentStreamCh <- artifact.Content
					}
				}
			}
		}
	}

	if stream.Err() != nil {
		doneCh <- stream.Err()
	}

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
