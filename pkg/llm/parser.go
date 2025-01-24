package llm

import (
	"regexp"
	"strings"

	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
)

type HelmResponse struct {
	Title   string
	Files   []types.HelmFile
	Actions map[string]types.ActionPlan
}

// Parser maintains state for streaming parse
type Parser struct {
	buffer string
	result HelmResponse
}

func NewParser() *Parser {
	return &Parser{
		result: HelmResponse{
			Actions: make(map[string]types.ActionPlan),
			Files:   make([]types.HelmFile, 0),
		},
	}
}

func (p *Parser) ParsePlan(chunk string) {
	p.buffer += chunk

	// Extract title if we haven't already
	if p.result.Title == "" {
		titleRegex := regexp.MustCompile(`<chartsmithArtifactPlan.*?title="([^"]*)"[^>]*>`)
		if match := titleRegex.FindStringSubmatch(p.buffer); len(match) > 1 {
			p.result.Title = match[1]
		}
	}

	// Find all action plans including their content
	fileStartRegex := regexp.MustCompile(`(?s)<chartsmithActionPlan\s+type="([^"]+)"\s+action="([^"]+)"\s+path="([^"]+)"[^>]*>.*?</chartsmithActionPlan>`)
	startMatches := fileStartRegex.FindAllStringSubmatch(p.buffer, -1)

	for _, match := range startMatches {
		if len(match) != 4 {
			continue
		}
		actionType := match[1] // "file"
		action := match[2]     // "create" or "update"
		path := match[3]       // file path

		// strip any leading /
		path = strings.TrimPrefix(path, "/")

		// Check if we already have this file
		fileExists := false
		for _, existingFile := range p.result.Files {
			if existingFile.Path == path {
				fileExists = true
				break
			}
		}

		if !fileExists {
			actionPlan := types.ActionPlan{
				Type:   actionType,
				Action: action,
			}

			p.result.Actions[path] = actionPlan
		}
	}
}

// GetResult returns the current parse results
func (p *Parser) GetResult() HelmResponse {
	return p.result
}
