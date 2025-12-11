package llm

import (
	"context"
	"fmt"
	"strings"

	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

// getChartStructure returns a string representation of the chart structure
// showing the file paths in a tree-like format
func getChartStructure(ctx context.Context, chart *workspacetypes.Chart) (string, error) {
	if chart == nil {
		return "No chart available", nil
	}

	if len(chart.Files) == 0 {
		return fmt.Sprintf("Chart: %s (no files yet)", chart.Name), nil
	}

	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("Chart: %s\n", chart.Name))
	builder.WriteString("Files:\n")

	// Sort files by path for consistent output
	files := chart.Files
	for _, file := range files {
		builder.WriteString(fmt.Sprintf("  - %s\n", file.FilePath))
	}

	return builder.String(), nil
}

