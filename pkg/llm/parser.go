package llm

import (
	"regexp"
	"strings"

	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
)

type HelmResponse struct {
	Title     string
	Artifacts []types.Artifact
	Actions   map[string]types.ActionPlan
}

// Parser maintains state for streaming parse
type Parser struct {
	buffer string
	result HelmResponse
}

func NewParser() *Parser {
	return &Parser{
		result: HelmResponse{
			Actions:   make(map[string]types.ActionPlan),
			Artifacts: make([]types.Artifact, 0),
		},
	}
}

// Helper to extract attributes from tag
func extractAttributes(attributes string) (path string, action string) {
	pathMatch := regexp.MustCompile(`path="([^"]*)"`)
	actionMatch := regexp.MustCompile(`action="([^"]*)"`)

	if match := pathMatch.FindStringSubmatch(attributes); len(match) > 1 {
		path = match[1]
	}
	if match := actionMatch.FindStringSubmatch(attributes); len(match) > 1 {
		action = match[1]
	}
	return
}

func (p *Parser) ParseArtifacts(chunk string) {
	p.buffer += chunk

	// Find complete artifacts first
	completeRegex := regexp.MustCompile(`(?s)<chartsmithArtifact([^>]*)>(.*?)</chartsmithArtifact>`)
	completeMatches := completeRegex.FindAllStringSubmatch(p.buffer, -1)

	for _, match := range completeMatches {
		if len(match) != 3 {
			continue
		}
		attributes := match[1]
		content := strings.TrimSpace(match[2])

		path, action := extractAttributes(attributes)
		if path != "" {
			p.addArtifact(content, path, action)
		}

		// Remove complete artifact from buffer
		p.buffer = strings.Replace(p.buffer, match[0], "", 1)
	}

	// Check for partial artifacts
	partialStart := strings.LastIndex(p.buffer, "<chartsmithArtifact")
	if partialStart != -1 {
		partialContent := p.buffer[partialStart:]

		// Try to extract path from the opening tag - removed extra quote mark from regex
		pathMatch := regexp.MustCompile(`<chartsmithArtifact[^>]*path="([^"]*)"`).FindStringSubmatch(partialContent)
		if len(pathMatch) > 1 {
			path := pathMatch[1]

			// Only process content if we found the closing angle bracket
			if strings.Contains(partialContent, ">") {
				contentStart := strings.Index(partialContent, ">") + 1
				content := strings.TrimSpace(partialContent[contentStart:])
				if content != "" {
					p.addArtifact(content, path, "")
				}
			}
		}
	}
}

// Helper to add artifact with content and path
func (p *Parser) addArtifact(content string, path string, action string) {
	artifact := types.Artifact{
		Content: content,
		Path:    path,
		Action:  action,
	}

	// Append if we have content or it's a delete action
	if artifact.Content != "" || artifact.Action == "delete" {
		p.result.Artifacts = append(p.result.Artifacts, artifact)
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
		artifactExists := false
		for _, existingArtifact := range p.result.Artifacts {
			if existingArtifact.Path == path {
				artifactExists = true
				break
			}
		}

		if !artifactExists {
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
