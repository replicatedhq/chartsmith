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

CRITICAL INSTRUCTION: You MUST generate a unified diff patch to correctly update this file.

FORMAT REQUIREMENTS:
1. Start with these two header lines:
   --- %s
   +++ %s

2. For each block of changes, create a patch hunk that starts with "@@ ... @@"
   - Do NOT include line numbers in these markers - use exactly "@@ ... @@"

3. When showing context and changes:
   - Prefix unchanged context lines with a single space
   - Prefix lines to be REMOVED with "-"
   - Prefix lines to be ADDED with "+"
   - Include AT LEAST 3 lines of unchanged context before and after your changes
   - Maintain EXACT indentation in all lines (context, added, and removed)

4. WHOLE BLOCKS: When editing functions, methods, classes, or other logical blocks:
   - Include the ENTIRE block in your diff (the whole function/method/loop/etc)
   - First show all lines of the original block with "-" prefix
   - Then show all lines of the new block with "+" prefix
   - This approach is MUCH more reliable than small surgical changes

5. SEPARATE HUNKS: Use separate hunks (@@ ... @@) for:
   - Different functions or blocks that aren't adjacent
   - Changes in different parts of the file
   - Each hunk should be complete and self-contained

6. INDENTATION: Preserve the EXACT whitespace/indentation of the original code

Example of a properly formatted diff:

--- path/to/file.yaml
+++ path/to/file.yaml
@@ ... @@
 class MyClass:
     def other_method(self):
         return True
-    def target_method(self, param1, param2):
-        # Original method
-        result = param1 + param2
-        return result
+    def target_method(self, param1, param2, param3=None):
+        # Updated method
+        if param3 is not None:
+            result = param1 + param2 + param3
+        else:
+            result = param1 + param2
+        return result
     def another_method(self):
         # This method stays the same
         pass

The diff above completely replaces the entire target_method with proper context.

Generate a high-quality diff and provide it within <chartsmithArtifact> tags.`,
			actionPlanWithPath.Path, strings.TrimSpace(currentContent), 
			actionPlanWithPath.Path, actionPlanWithPath.Path)

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