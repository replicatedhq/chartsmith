package integration

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/replicatedhq/chartsmith/pkg/embedding"
	"github.com/replicatedhq/chartsmith/pkg/llm"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
)

type TestOpts struct {
	WorkspaceID string
	ChartID     string
}

var IntegrationTestOpts_ChooseRelevantFilesForChatMessage = TestOpts{
	WorkspaceID: "workspace-relevant-files",
	ChartID:     "chart-relevant-files",
}

func IntegrationTest_ChooseRelevantFilesForChatMessage() error {
	fmt.Printf("Integration test: ChooseRelevantFilesForChatMessage\n")

	w, err := workspace.GetWorkspace(context.Background(), IntegrationTestOpts_ChooseRelevantFilesForChatMessage.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to get workspace: %w", err)
	}

	fns := []func(ctx context.Context, w *workspacetypes.Workspace) ([]string, error){
		chooseRelevantFilesForIngressQuery,
		// chooseRelevantFilesForOpenshiftQuery,
	}

	for _, fn := range fns {
		foundErrors, err := fn(context.Background(), w)
		if err != nil {
			return fmt.Errorf("failed to run function: %w", err)
		}
		if len(foundErrors) > 0 {
			return fmt.Errorf("found errors: %v", foundErrors)
		}
	}

	return nil
}

func parseGVK(content string) (string, error) {
	// Look for apiVersion and kind in the content
	var apiVersion, kind string

	// Split content into lines for processing
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		// Trim whitespace and handle potential template syntax
		trimmed := strings.TrimSpace(line)

		// Skip empty lines and comments
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// Match apiVersion, handling potential template syntax
		if strings.Contains(trimmed, "apiVersion:") {
			parts := strings.SplitN(trimmed, "apiVersion:", 2)
			if len(parts) == 2 {
				apiVersion = strings.TrimSpace(parts[1])
				// Remove any template syntax
				apiVersion = strings.Trim(apiVersion, "\"'{}}")
				apiVersion = strings.TrimPrefix(apiVersion, "{{ ")
				apiVersion = strings.TrimSuffix(apiVersion, " }}")
			}
		}

		// Match kind, handling potential template syntax
		if strings.Contains(trimmed, "kind:") {
			parts := strings.SplitN(trimmed, "kind:", 2)
			if len(parts) == 2 {
				kind = strings.TrimSpace(parts[1])
				// Remove any template syntax
				kind = strings.Trim(kind, "\"'{}}")
				kind = strings.TrimPrefix(kind, "{{ ")
				kind = strings.TrimSuffix(kind, " }}")
			}
		}

		// If we found both, we can construct the GVK
		if apiVersion != "" && kind != "" {
			// Split apiVersion into group and version
			group := ""
			version := apiVersion
			if strings.Contains(apiVersion, "/") {
				parts := strings.SplitN(apiVersion, "/", 2)
				group = parts[0]
				version = parts[1]
			}

			// Construct GVK string
			if group != "" {
				return fmt.Sprintf("%s/%s/%s", group, version, kind), nil
			}
			return fmt.Sprintf("core/%s/%s", version, kind), nil
		}
	}

	// If we didn't find both apiVersion and kind, return empty string
	return "", nil
}

func chooseRelevantFilesForIngressQuery(ctx context.Context, w *workspacetypes.Workspace) ([]string, error) {
	prompt := `Will this chart work with an ingress controller?`
	expandedPrompt, err := llm.ExpandPrompt(context.Background(), prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to expand prompt: %w", err)
	}

	relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(
		context.Background(),
		w,
		IntegrationTestOpts_ChooseRelevantFilesForChatMessage.ChartID,
		1,
		expandedPrompt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to choose relevant files: %w", err)
	}

	maxResults := len(relevantFiles) / 10
	if maxResults < 10 {
		maxResults = 10
	}

	foundFilesWithGVK := map[string]string{}
	for _, file := range relevantFiles {
		if file.Similarity < 0.8 || len(foundFilesWithGVK) >= maxResults {
			continue
		}

		gvk, err := parseGVK(file.File.Content)
		if err != nil {
			continue
		}

		foundFilesWithGVK[file.File.FilePath] = gvk
	}

	foundErrors := []string{}

	// we know the okteto base chart to know that we expect some specific files to be returned
	// since this is a very non-deterministic call though, we don't just assert that the exact files are
	// returned.
	expectedFiles := []string{
		"values.yaml",
		"Chart.yaml",
		"templates/ingress.yaml",
		"templates/ingress-wildcard.yaml",
	}

	missingExpectedFiles := []string{}
	for _, file := range expectedFiles {
		if _, ok := foundFilesWithGVK[file]; !ok {
			missingExpectedFiles = append(missingExpectedFiles, file)
		}
	}

	if len(missingExpectedFiles) > 0 {
		for _, file := range missingExpectedFiles {
			foundErrors = append(foundErrors, fmt.Sprintf("missing expected file: %s", file))
		}
	}

	if len(foundErrors) > 0 {
		if len(missingExpectedFiles) > 0 {
			fmt.Printf("Found files: %v\n", foundFilesWithGVK)
		}
		return foundErrors, nil
	}

	for file := range foundFilesWithGVK {
		fmt.Printf("Found file: %s\n", file)
	}

	return nil, nil
}

func chooseRelevantFilesForOpenshiftQuery(ctx context.Context, w *workspacetypes.Workspace) ([]string, error) {
	prompt := `Will this chart support deploying on OpenShift?`
	relevantFiles, err := workspace.ChooseRelevantFilesForChatMessage(
		context.Background(),
		w,
		IntegrationTestOpts_ChooseRelevantFilesForChatMessage.ChartID,
		1,
		prompt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to choose relevant files: %w", err)
	}

	if len(relevantFiles) > 10 {
		return nil, fmt.Errorf("too many relevant files: %d", len(relevantFiles))
	}

	hasChartYAML := false
	hasValuesYAML := false
	for _, file := range relevantFiles {
		if file.File.FilePath == "Chart.yaml" {
			hasChartYAML = true
		}
		if file.File.FilePath == "values.yaml" {
			hasValuesYAML = true
		}
	}

	foundErrors := []string{}
	if !hasChartYAML {
		foundErrors = append(foundErrors, "no Chart.yaml found")
	}
	if !hasValuesYAML {
		foundErrors = append(foundErrors, "no values.yaml found")
	}

	if len(foundErrors) > 0 {
		return foundErrors, nil
	}

	return nil, nil
}

// this is a test data function
func IntegrationTestData_ChooseRelevantFilesForChatMessage(ctx context.Context) error {
	// create a workspace with a complex helm chart in it
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, current_revision_number) VALUES ($1, now(), now(), $2, $3, $4, 1)`
	_, err := conn.Exec(ctx, query, IntegrationTestOpts_ChooseRelevantFilesForChatMessage.WorkspaceID, "Test Workspace", "testuser", "testtype")
	if err != nil {
		return fmt.Errorf("failed to create workspace: %w", err)
	}

	query = `INSERT INTO workspace_revision (workspace_id, revision_number, created_at, plan_id, created_by_user_id, created_type, is_complete, is_rendered) VALUES ($1, 1, now(), null, $2, $3, true, false)`
	_, err = conn.Exec(ctx, query, IntegrationTestOpts_ChooseRelevantFilesForChatMessage.WorkspaceID, "testuser", "testtype")
	if err != nil {
		return fmt.Errorf("failed to create workspace revision: %w", err)
	}

	// create a chart in this workspace
	query = `INSERT INTO workspace_chart (id, workspace_id, name, revision_number) VALUES ($1, $2, $3, 1)`
	_, err = conn.Exec(ctx, query, IntegrationTestOpts_ChooseRelevantFilesForChatMessage.ChartID, IntegrationTestOpts_ChooseRelevantFilesForChatMessage.WorkspaceID, "Test Chart")
	if err != nil {
		return fmt.Errorf("failed to create chart: %w", err)
	}

	// and our chart
	chartFiles, err := IntegrationTestChart_ChooseRelevantFilesForChatMessage()
	if err != nil {
		return fmt.Errorf("failed to get chart files: %w", err)
	}

	var currentFileCount int32
	var wg sync.WaitGroup
	sem := make(chan struct{}, 15)

	for filePath, content := range chartFiles {
		wg.Add(1)
		sem <- struct{}{} // Acquire semaphore

		go func(filePath, content string) {
			fmt.Printf("Preparing file: %s\n", filePath)
			defer wg.Done()
			defer func() { <-sem }() // Release semaphore

			embeddings, err := embedding.Embeddings(content)
			if err != nil {
				fmt.Printf("Error embedding file: %v\n", err)
				return
			}

			id, err := securerandom.Hex(6)
			if err != nil {
				fmt.Printf("Error generating file ID: %v\n", err)
				return
			}

			localConn := persistence.MustGetPooledPostgresSession()
			defer localConn.Release()

			query = `INSERT INTO workspace_file (id, revision_number, chart_id, workspace_id, file_path, content) VALUES ($1, $2, $3, $4, $5, $6)`
			_, err = conn.Exec(ctx, query, id, 1, IntegrationTestOpts_ChooseRelevantFilesForChatMessage.ChartID, IntegrationTestOpts_ChooseRelevantFilesForChatMessage.WorkspaceID, filePath, content)
			if err != nil {
				fmt.Printf("Error creating file: %v\n", err)
				return
			}

			query = `UPDATE workspace_file SET embeddings = $1 WHERE id = $2`
			_, err = conn.Exec(ctx, query, embeddings, id)
			if err != nil {
				fmt.Printf("Error updating file: %v\n", err)
				return
			}

			localConn.Release()

			atomic.AddInt32(&currentFileCount, 1)

			fmt.Printf("Summarized and vectorized %d/%d files\n", atomic.LoadInt32(&currentFileCount), len(chartFiles))
		}(filePath, content)
	}

	wg.Wait()

	return nil
}
