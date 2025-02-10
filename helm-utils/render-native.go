//go:build never
// +build never

package helmutils

import (
	"fmt"
	"strings"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/chartutil"
	"helm.sh/helm/v3/pkg/cli"

	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// RenderChartNative renders a Helm chart with the given files and values
func RenderChartNative(files []types.File, valuesYAML string) (string, error) {
	// Create a new chart loader
	settings := cli.New()
	actionConfig := new(action.Configuration)

	// Initialize without cluster communication
	if err := actionConfig.Init(settings.RESTClientGetter(), "", "", nil); err != nil {
		return "", err
	}

	// Create install action with dry-run for templating
	install := action.NewInstall(actionConfig)
	install.DryRun = true
	install.ReleaseName = "chartsmith"
	install.ClientOnly = true // Skip cluster communication

	// Convert workspace files to chart files
	chartFiles := make([]*chart.File, 0, len(files))
	templates := make([]*chart.File, 0, len(files))
	for _, file := range files {
		fmt.Printf("adding file at %s\n", file.FilePath)
		if strings.HasPrefix(file.FilePath, "templates/") {
			// Add to Templates if it's in the templates directory
			templates = append(templates, &chart.File{
				Name: file.FilePath,
				Data: []byte(file.Content),
			})
		} else {
			// All other files go to Files
			chartFiles = append(chartFiles, &chart.File{
				Name: file.FilePath,
				Data: []byte(file.Content),
			})
		}
	}

	// Create in-memory chart
	c := &chart.Chart{
		Metadata: &chart.Metadata{
			Name:       "chartsmith",
			Version:    "0.1.0",
			APIVersion: "v2",
		},
		Files:     chartFiles,
		Templates: templates, // Add templates separately
	}

	// Parse values
	values := map[string]interface{}{}
	if valuesYAML != "" {
		var err error
		values, err = chartutil.ReadValues([]byte(valuesYAML))
		if err != nil {
			return "", fmt.Errorf("failed to parse values: %w", err)
		}
	}

	// Render the templates
	rendered, err := install.Run(c, values)
	if err != nil {
		return "", err
	}

	return rendered.Manifest, nil
}
