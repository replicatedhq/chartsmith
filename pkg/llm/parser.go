package llm

import (
	"fmt"
	"regexp"
	"strings"
)

type HelmFile struct {
	Path           string
	Content        string
	PartialContent string
}

type HelmResponse struct {
	Title string
	Files []HelmFile
}

// Parser maintains state for streaming parse
type Parser struct {
	buffer        string
	currentFile   *HelmFile
	result        HelmResponse
	inArtifact    bool
	inFileAction  bool
	partialBuffer string
}

func NewParser() *Parser {
	return &Parser{
		result: HelmResponse{
			Files: make([]HelmFile, 0),
		},
	}
}

func (p *Parser) Parse(chunk string) {
	p.buffer += chunk

	// Extract title if we haven't already
	if p.result.Title == "" {
		titleRegex := regexp.MustCompile(`<helmsmithArtifact.*title="([^"]*)">`)
		if match := titleRegex.FindStringSubmatch(p.buffer); len(match) > 1 {
			p.result.Title = match[1]
		}
	}

	// Find starts of new files
	fileStartRegex := regexp.MustCompile(`<helmsmithAction type="file" path="([^"]*)"`)
	startMatches := fileStartRegex.FindAllStringSubmatchIndex(p.buffer, -1)

	for _, match := range startMatches {
		path := p.buffer[match[2]:match[3]]

		// Check if we already have this file
		fileExists := false
		for _, existingFile := range p.result.Files {
			if existingFile.Path == path {
				fileExists = true
				break
			}
		}

		// If it's a new file, add it immediately
		if !fileExists {
			// Find where the content starts (after the closing >)
			contentStart := strings.Index(p.buffer[match[0]:], ">") + match[0] + 1
			contentEnd := strings.Index(p.buffer[contentStart:], "</helmsmithAction>")
			if contentStart > match[0] {
				helmFile := HelmFile{
					Path: path,
				}
				if contentEnd > 0 {
					helmFile.Content = p.buffer[contentStart : contentStart+contentEnd]
				} else {
					helmFile.Content = p.buffer[contentStart:]
				}
				helmFile.Content = strings.TrimSpace(helmFile.Content)
				p.result.Files = append(p.result.Files, helmFile)
			}
		}
	}

	// Update content for all files
	for i := range p.result.Files {
		file := &p.result.Files[i]

		// Find the start of this file's content in the buffer
		startPattern := fmt.Sprintf(`<helmsmithAction type="file" path="%s">`, regexp.QuoteMeta(file.Path))
		startIndex := strings.Index(p.buffer, startPattern)
		if startIndex != -1 {
			contentStart := startIndex + len(startPattern)

			// Check if we have an end tag for this file
			endPattern := "</helmsmithAction>"
			endIndex := strings.Index(p.buffer[contentStart:], endPattern)

			if endIndex != -1 {
				// We have complete content
				file.Content = p.buffer[contentStart : contentStart+endIndex]
				// Remove this complete file from buffer
				fullContent := p.buffer[startIndex : contentStart+endIndex+len(endPattern)]
				p.buffer = strings.Replace(p.buffer, fullContent, "", 1)
			} else {
				// Partial content - update with everything after the start tag
				file.PartialContent = p.buffer[contentStart:]
			}
		}
	}
}

// GetResult returns the current parse results
func (p *Parser) GetResult() HelmResponse {
	return p.result
}
