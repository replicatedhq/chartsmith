package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	realtimetypes "github.com/replicatedhq/chartsmith/pkg/realtime/types"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
	"gopkg.in/yaml.v2"
)

type newConversionPayload struct {
	ConversionID string `json:"conversionId"`
}

func handleNewConversionNotification(ctx context.Context, payload string) error {
	logger.Info("Received new conversion notification",
		zap.String("payload", payload),
	)

	var p newConversionPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	c, err := workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	userIDs, err := workspace.ListUserIDsForWorkspace(ctx, c.WorkspaceID)
	if err != nil {
		return fmt.Errorf("failed to list user IDs for workspace: %w", err)
	}

	realtimeRecipient := realtimetypes.Recipient{
		UserIDs: userIDs,
	}

	if err := workspace.SetConversionStatus(ctx, c.ID, workspacetypes.ConversionStatusAnalyzing); err != nil {
		return fmt.Errorf("failed to set conversation status: %w", err)
	}

	c, err = workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	e := realtimetypes.ConversionStatusEvent{
		WorkspaceID: c.WorkspaceID,
		Conversion:  *c,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversation status event: %w", err)
	}

	if err := workspace.SetConversionStatus(ctx, c.ID, workspacetypes.ConversionStatusSorting); err != nil {
		return fmt.Errorf("failed to set conversation status: %w", err)
	}

	c, err = workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	e = realtimetypes.ConversionStatusEvent{
		WorkspaceID: c.WorkspaceID,
		Conversion:  *c,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversation status event: %w", err)
	}

	// we need to inject a values.yaml and a Chart.yaml into the conversion
	// other files that might be injected happen in the final stage, but these
	// are needed
	if err := workspace.AddDefaultFilesToConversion(ctx, c.ID); err != nil {
		return fmt.Errorf("failed to add default files to conversion: %w", err)
	}

	conversionFiles, err := workspace.ListFilesToConvert(ctx, c.ID)
	if err != nil {
		return fmt.Errorf("failed to list files to convert: %w", err)
	}

	if len(conversionFiles) == 0 {
		return nil
	}

	if err := persistence.EnqueueWork(ctx, "conversion_next_file", map[string]interface{}{
		"workspaceId":  c.WorkspaceID,
		"conversionId": c.ID,
	}); err != nil {
		return fmt.Errorf("failed to enqueue file conversion: %w", err)
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversation status event: %w", err)
	}

	if err := workspace.SetConversionStatus(ctx, c.ID, workspacetypes.ConversionStatusTemplating); err != nil {
		return fmt.Errorf("failed to set conversation status: %w", err)
	}

	c, err = workspace.GetConversion(ctx, p.ConversionID)
	if err != nil {
		return fmt.Errorf("failed to get conversion: %w", err)
	}

	e = realtimetypes.ConversionStatusEvent{
		WorkspaceID: c.WorkspaceID,
		Conversion:  *c,
	}

	if err := realtime.SendEvent(ctx, realtimeRecipient, e); err != nil {
		return fmt.Errorf("failed to send conversation status event: %w", err)
	}

	return nil
}

// sortByConversionOrder sorts the conversion files in a specific order
// ConfigMaps first, then Secrets, then anything else
// For ties, sort alphabetically by GVK and name
func sortByConversionOrder(files []workspacetypes.ConversionFile) []workspacetypes.ConversionFile {
	// Create a copy of the slice to avoid modifying the original
	sortedFiles := make([]workspacetypes.ConversionFile, len(files))
	copy(sortedFiles, files)

	// Sort the files by GVK priority and then alphabetically
	sort.Slice(sortedFiles, func(i, j int) bool {
		// Extract GVK and name from file content
		iGVK, iName := extractGVKAndName(sortedFiles[i].FileContent)
		jGVK, jName := extractGVKAndName(sortedFiles[j].FileContent)

		// Get GVK priority (ConfigMap = 0, Secret = 1, Deployment = 2, others = 3)
		iPriority := getGVKPriority(iGVK)
		jPriority := getGVKPriority(jGVK)

		// If priorities are different, sort by priority
		if iPriority != jPriority {
			return iPriority < jPriority
		}

		// If GVKs are different, sort alphabetically by GVK
		if iGVK != jGVK {
			return iGVK < jGVK
		}

		// If GVKs are the same, sort by name
		return iName < jName
	})

	return sortedFiles
}

// extractGVKAndName parses YAML content to extract GVK and name
func extractGVKAndName(content string) (string, string) {
	type metadata struct {
		Name string `yaml:"name"`
	}

	type k8sResource struct {
		APIVersion string   `yaml:"apiVersion"`
		Kind       string   `yaml:"kind"`
		Metadata   metadata `yaml:"metadata"`
	}

	var resource k8sResource
	if err := yaml.Unmarshal([]byte(content), &resource); err != nil {
		// If parsing fails, return empty strings
		fmt.Printf("Failed to parse YAML content: %v\n", err)
		logger.Debug("Failed to parse YAML content", zap.Error(err))
		return "", ""
	}

	gvk := resource.APIVersion + "/" + resource.Kind

	return gvk, resource.Metadata.Name
}

// getGVKPriority returns a priority value for a GVK
// ConfigMap = 0, Secret = 1, Deployment = 2, others = 3
func getGVKPriority(gvk string) int {
	switch gvk {
	case "v1/ConfigMap":
		return 0
	case "v1/Secret":
		return 1
	case "v1/PersistentVolumeClaim":
		return 2
	case "v1/ServiceAccount":
		return 3
	case "v1/Role":
		return 4
	case "v1/RoleBinding":
		return 5
	case "v1/ClusterRole":
		return 6
	case "v1/ClusterRoleBinding":
		return 7
	case "apps/v1/Deployment":
		return 8
	case "v1/StatefulSet":
		return 9
	case "v1/Service":
		return 10
	default:
		return 11
	}
}
