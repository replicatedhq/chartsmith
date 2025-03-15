package debugcli

import (
	"fmt"
	"math/rand"
	"strings"
)

// PatchType represents different types of patches that can be generated
type PatchType string

const (
	PatchTypeAddValue      PatchType = "add-value"
	PatchTypeChangeValue   PatchType = "change-value"
	PatchTypeRemoveValue   PatchType = "remove-value"
	PatchTypeAddBlock      PatchType = "add-block"
	PatchTypeRemoveBlock   PatchType = "remove-block"
	PatchTypeIndentation   PatchType = "indentation"
	PatchTypeComments      PatchType = "comments"
	PatchTypeReplaceBlock  PatchType = "replace-block"
	PatchTypeRenameKey     PatchType = "rename-key"
	PatchTypeSwapSections  PatchType = "swap-sections"
)

// LineType categorizes what kind of line we're dealing with
type LineType int

const (
	LineTypeEmpty LineType = iota
	LineTypeComment
	LineTypeKey
	LineTypeListItem
	LineTypeBlockStart
)

// YAMLLine represents a line in the YAML file with additional metadata
type YAMLLine struct {
	Content   string
	LineType  LineType
	Indent    int
	Key       string // For key-value lines
	Value     string // For key-value lines
	LineNum   int
	ParentKey string
}

// PatchGenerator generates different kinds of patches for YAML files
type PatchGenerator struct {
	content     string
	lines       []string
	parsedLines []YAMLLine
	patchTypes  []PatchType
}

// NewPatchGenerator creates a new patch generator for the given content
func NewPatchGenerator(content string) *PatchGenerator {
	pg := &PatchGenerator{
		content: content,
		lines:   strings.Split(content, "\n"),
		patchTypes: []PatchType{
			PatchTypeAddValue,
			PatchTypeChangeValue,
			PatchTypeRemoveValue,
			PatchTypeAddBlock,
			PatchTypeComments,
			PatchTypeRenameKey,
		},
	}
	
	pg.parseLines()
	return pg
}

// parseLines analyzes the YAML content line by line
func (pg *PatchGenerator) parseLines() {
	pg.parsedLines = make([]YAMLLine, 0, len(pg.lines))
	parentKeyStack := []string{""}
	
	for i, line := range pg.lines {
		trimmed := strings.TrimSpace(line)
		indent := len(line) - len(strings.TrimLeft(line, " \t"))
		
		yamlLine := YAMLLine{
			Content:  line,
			LineNum:  i,
			Indent:   indent,
		}
		
		// Track parent based on indentation
		for len(parentKeyStack) > 0 && (len(parentKeyStack) > 1 && indent <= pg.parsedLines[pg.getLastLineWithIndent(indent)].Indent) {
			parentKeyStack = parentKeyStack[:len(parentKeyStack)-1]
		}
		
		if len(parentKeyStack) > 0 {
			yamlLine.ParentKey = parentKeyStack[len(parentKeyStack)-1]
		}
		
		// Determine line type
		switch {
		case trimmed == "":
			yamlLine.LineType = LineTypeEmpty
		case strings.HasPrefix(trimmed, "#"):
			yamlLine.LineType = LineTypeComment
		case strings.HasPrefix(trimmed, "-"):
			yamlLine.LineType = LineTypeListItem
			yamlLine.Value = strings.TrimSpace(strings.TrimPrefix(trimmed, "-"))
		case strings.Contains(trimmed, ":") && !strings.Contains(trimmed, "://"):
			parts := strings.SplitN(trimmed, ":", 2)
			key := strings.TrimSpace(parts[0])
			value := ""
			if len(parts) > 1 {
				value = strings.TrimSpace(parts[1])
			}
			yamlLine.LineType = LineTypeKey
			yamlLine.Key = key
			yamlLine.Value = value
			
			// If this is a block start (ends with :), push to parent stack
			if value == "" || value == "{}" {
				yamlLine.LineType = LineTypeBlockStart
				parentKeyStack = append(parentKeyStack, key)
			}
		default:
			// Handle continuation lines for multi-line values
			yamlLine.LineType = LineTypeListItem
			yamlLine.Value = trimmed
		}
		
		pg.parsedLines = append(pg.parsedLines, yamlLine)
	}
}

// getLastLineWithIndent finds the index of the last line with given indent level
func (pg *PatchGenerator) getLastLineWithIndent(indent int) int {
	for i := len(pg.parsedLines) - 1; i >= 0; i-- {
		if pg.parsedLines[i].Indent <= indent {
			return i
		}
	}
	return 0
}

// GeneratePatch creates a unified diff patch for the YAML file
func (pg *PatchGenerator) GeneratePatch() string {
	// Select a random patch type
	patchType := pg.patchTypes[rand.Intn(len(pg.patchTypes))]
	
	var patch string
	switch patchType {
	case PatchTypeAddValue:
		patch = pg.generateAddValuePatch()
	case PatchTypeChangeValue:
		patch = pg.generateChangeValuePatch()
	case PatchTypeRemoveValue:
		patch = pg.generateRemoveValuePatch()
	case PatchTypeAddBlock:
		patch = pg.generateAddBlockPatch()
	case PatchTypeComments:
		patch = pg.generateCommentsPatch()
	case PatchTypeRenameKey:
		patch = pg.generateRenameKeyPatch()
	default:
		// If something goes wrong, fall back to adding a value
		patch = pg.generateAddValuePatch()
	}
	
	return patch
}

// generateAddValuePatch creates a patch that adds a new value to the YAML
func (pg *PatchGenerator) generateAddValuePatch() string {
	// Find a block where we can add a value
	blockLines := pg.findBlockStartLines()
	if len(blockLines) == 0 {
		// Fallback to adding at root level
		return pg.generateRootLevelValuePatch()
	}
	
	// Pick a random block
	blockLine := blockLines[rand.Intn(len(blockLines))]
	
	// Determine the indentation level for the new value
	indentation := blockLine.Indent + 2
	
	// Generate a random key and value
	key := fmt.Sprintf("new_%s_%d", getRandomItem(randomNames), rand.Intn(100))
	value := generateRandomValue(key)
	
	// For string values, wrap in quotes
	if !strings.ContainsAny(value, "{}[]") && !isNumeric(value) && value != "true" && value != "false" {
		value = fmt.Sprintf("\"%s\"", value)
	}
	
	// Build the patch
	newLine := fmt.Sprintf("%s%s: %s", strings.Repeat(" ", indentation), key, value)
	
	// Find the last line in this block to insert after
	lastLineIndex := blockLine.LineNum
	for i := blockLine.LineNum + 1; i < len(pg.parsedLines); i++ {
		if pg.parsedLines[i].Indent <= blockLine.Indent {
			break
		}
		lastLineIndex = i
	}
	
	// Generate the patch
	var builder strings.Builder
	builder.WriteString("--- file\n")
	builder.WriteString("+++ file\n")
	builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
		lastLineIndex+1, 1, 
		lastLineIndex+1, 2))
	builder.WriteString(fmt.Sprintf(" %s\n", pg.lines[lastLineIndex]))
	builder.WriteString(fmt.Sprintf("+%s\n", newLine))
	
	return builder.String()
}

// generateRootLevelValuePatch creates a patch that adds a value at root level
func (pg *PatchGenerator) generateRootLevelValuePatch() string {
	// Generate random key and value
	key := fmt.Sprintf("root_%s_%d", getRandomItem(randomNames), rand.Intn(100))
	value := generateRandomValue(key)
	
	// For string values, wrap in quotes
	if !strings.ContainsAny(value, "{}[]") && !isNumeric(value) && value != "true" && value != "false" {
		value = fmt.Sprintf("\"%s\"", value)
	}
	
	// Find where to insert (after the last root level entry)
	lastRootIndex := len(pg.lines) - 1
	for i := len(pg.parsedLines) - 1; i >= 0; i-- {
		if pg.parsedLines[i].Indent == 0 && pg.parsedLines[i].LineType != LineTypeEmpty {
			lastRootIndex = pg.parsedLines[i].LineNum
			break
		}
	}
	
	// Build the patch
	var builder strings.Builder
	builder.WriteString("--- file\n")
	builder.WriteString("+++ file\n")
	builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
		lastRootIndex+1, 1, 
		lastRootIndex+1, 2))
	builder.WriteString(fmt.Sprintf(" %s\n", pg.lines[lastRootIndex]))
	builder.WriteString(fmt.Sprintf("+%s: %s\n", key, value))
	
	return builder.String()
}

// generateChangeValuePatch creates a patch that changes an existing value
func (pg *PatchGenerator) generateChangeValuePatch() string {
	// Find lines with values that we can change
	valueLines := make([]YAMLLine, 0)
	for _, line := range pg.parsedLines {
		if line.LineType == LineTypeKey && line.Value != "" {
			valueLines = append(valueLines, line)
		}
	}
	
	if len(valueLines) == 0 {
		// Fall back to adding a value
		return pg.generateAddValuePatch()
	}
	
	// Pick a random value to change
	valueLine := valueLines[rand.Intn(len(valueLines))]
	
	// Generate a new value
	newValue := generateRandomValue(valueLine.Key)
	
	// For string values, wrap in quotes if the original had them
	if strings.HasPrefix(valueLine.Value, "\"") && strings.HasSuffix(valueLine.Value, "\"") {
		newValue = fmt.Sprintf("\"%s\"", newValue)
	}
	
	// Build the new line with the same indentation
	newLine := fmt.Sprintf("%s%s: %s", strings.Repeat(" ", valueLine.Indent), valueLine.Key, newValue)
	
	// Generate the patch
	var builder strings.Builder
	builder.WriteString("--- file\n")
	builder.WriteString("+++ file\n")
	builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
		valueLine.LineNum+1, 1, 
		valueLine.LineNum+1, 1))
	builder.WriteString(fmt.Sprintf("-%s\n", pg.lines[valueLine.LineNum]))
	builder.WriteString(fmt.Sprintf("+%s\n", newLine))
	
	return builder.String()
}

// generateRemoveValuePatch creates a patch that removes a value
func (pg *PatchGenerator) generateRemoveValuePatch() string {
	// Find lines with values that we can remove
	valueLines := make([]YAMLLine, 0)
	for _, line := range pg.parsedLines {
		if line.LineType == LineTypeKey && line.Value != "" {
			valueLines = append(valueLines, line)
		}
	}
	
	if len(valueLines) == 0 {
		// Fall back to adding a value
		return pg.generateAddValuePatch()
	}
	
	// Pick a random value to remove
	valueLine := valueLines[rand.Intn(len(valueLines))]
	
	// Get context lines
	contextBefore := ""
	if valueLine.LineNum > 0 {
		contextBefore = pg.lines[valueLine.LineNum-1]
	}
	
	contextAfter := ""
	if valueLine.LineNum < len(pg.lines)-1 {
		contextAfter = pg.lines[valueLine.LineNum+1]
	}
	
	// Generate the patch
	var builder strings.Builder
	builder.WriteString("--- file\n")
	builder.WriteString("+++ file\n")
	
	// If we have context lines, include them
	if contextBefore != "" && contextAfter != "" {
		builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
			valueLine.LineNum, 3, 
			valueLine.LineNum, 2))
		builder.WriteString(fmt.Sprintf(" %s\n", contextBefore))
		builder.WriteString(fmt.Sprintf("-%s\n", pg.lines[valueLine.LineNum]))
		builder.WriteString(fmt.Sprintf(" %s\n", contextAfter))
	} else if contextBefore != "" {
		builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
			valueLine.LineNum, 2, 
			valueLine.LineNum, 1))
		builder.WriteString(fmt.Sprintf(" %s\n", contextBefore))
		builder.WriteString(fmt.Sprintf("-%s\n", pg.lines[valueLine.LineNum]))
	} else if contextAfter != "" {
		builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
			valueLine.LineNum+1, 2, 
			valueLine.LineNum+1, 1))
		builder.WriteString(fmt.Sprintf("-%s\n", pg.lines[valueLine.LineNum]))
		builder.WriteString(fmt.Sprintf(" %s\n", contextAfter))
	} else {
		builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
			valueLine.LineNum+1, 1, 
			valueLine.LineNum+1, 0))
		builder.WriteString(fmt.Sprintf("-%s\n", pg.lines[valueLine.LineNum]))
	}
	
	return builder.String()
}

// generateAddBlockPatch creates a patch that adds a new YAML block
func (pg *PatchGenerator) generateAddBlockPatch() string {
	// Find a place to add a block - either at root level or in an existing block
	insertAfterLine := 0
	indentation := 0
	
	// First, try to find a block to add to
	blockLines := pg.findBlockStartLines()
	if len(blockLines) > 0 {
		// Pick a random block
		blockLine := blockLines[rand.Intn(len(blockLines))]
		indentation = blockLine.Indent + 2
		
		// Find the last line in this block to insert after
		insertAfterLine = blockLine.LineNum
		for i := blockLine.LineNum + 1; i < len(pg.parsedLines); i++ {
			if pg.parsedLines[i].Indent <= blockLine.Indent {
				break
			}
			insertAfterLine = i
		}
	} else {
		// Use root level
		for i := len(pg.parsedLines) - 1; i >= 0; i-- {
			if pg.parsedLines[i].Indent == 0 && pg.parsedLines[i].LineType != LineTypeEmpty {
				insertAfterLine = pg.parsedLines[i].LineNum
				break
			}
		}
	}
	
	// Generate a block name
	blockName := fmt.Sprintf("new_%s_%d", getRandomItem(randomNames), rand.Intn(100))
	
	// Create the block with random content
	var blockBuilder strings.Builder
	blockBuilder.WriteString(fmt.Sprintf("%s%s:\n", strings.Repeat(" ", indentation), blockName))
	
	// Add 2-5 fields to the block
	fieldCount := rand.Intn(4) + 2
	for i := 0; i < fieldCount; i++ {
		fieldName := fmt.Sprintf("field_%d", i+1)
		fieldValue := generateRandomValue(fieldName)
		
		// For string values, wrap in quotes
		if !strings.ContainsAny(fieldValue, "{}[]") && !isNumeric(fieldValue) && fieldValue != "true" && fieldValue != "false" {
			fieldValue = fmt.Sprintf("\"%s\"", fieldValue)
		}
		
		blockBuilder.WriteString(fmt.Sprintf("%s  %s: %s\n", strings.Repeat(" ", indentation), fieldName, fieldValue))
	}
	
	blockContent := blockBuilder.String()
	
	// Create the patch
	var patchBuilder strings.Builder
	patchBuilder.WriteString("--- file\n")
	patchBuilder.WriteString("+++ file\n")
	patchBuilder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
		insertAfterLine+1, 1, 
		insertAfterLine+1, 1+strings.Count(blockContent, "\n")))
	patchBuilder.WriteString(fmt.Sprintf(" %s\n", pg.lines[insertAfterLine]))
	patchBuilder.WriteString(blockContent)
	
	return patchBuilder.String()
}

// generateCommentsPatch creates a patch that adds, modifies, or removes comments
func (pg *PatchGenerator) generateCommentsPatch() string {
	// Randomly decide whether to add a new comment or modify an existing one
	if rand.Float32() < 0.7 || len(pg.findCommentLines()) == 0 {
		// Add a new comment
		return pg.generateAddCommentPatch()
	} else {
		// Modify an existing comment
		return pg.generateChangeCommentPatch()
	}
}

// generateAddCommentPatch creates a patch that adds a new comment
func (pg *PatchGenerator) generateAddCommentPatch() string {
	// Decide where to add the comment - before a random non-empty line
	nonEmptyLines := make([]YAMLLine, 0)
	for _, line := range pg.parsedLines {
		if line.LineType != LineTypeEmpty {
			nonEmptyLines = append(nonEmptyLines, line)
		}
	}
	
	if len(nonEmptyLines) == 0 {
		// Fall back to adding at the beginning
		return pg.generateAddValuePatch()
	}
	
	// Pick a random line
	targetLine := nonEmptyLines[rand.Intn(len(nonEmptyLines))]
	
	// Generate a comment
	commentText := getRandomComment()
	indentation := targetLine.Indent
	
	// Build the comment line
	commentLine := fmt.Sprintf("%s# %s", strings.Repeat(" ", indentation), commentText)
	
	// Generate the patch
	var builder strings.Builder
	builder.WriteString("--- file\n")
	builder.WriteString("+++ file\n")
	builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
		targetLine.LineNum+1, 1, 
		targetLine.LineNum+1, 2))
	builder.WriteString(fmt.Sprintf("+%s\n", commentLine))
	builder.WriteString(fmt.Sprintf(" %s\n", pg.lines[targetLine.LineNum]))
	
	return builder.String()
}

// generateChangeCommentPatch modifies an existing comment
func (pg *PatchGenerator) generateChangeCommentPatch() string {
	commentLines := pg.findCommentLines()
	if len(commentLines) == 0 {
		return pg.generateAddCommentPatch()
	}
	
	// Pick a random comment
	commentLine := commentLines[rand.Intn(len(commentLines))]
	
	// Generate a new comment
	newCommentText := getRandomComment()
	indentation := commentLine.Indent
	
	// Build the new comment line
	newCommentLine := fmt.Sprintf("%s# %s", strings.Repeat(" ", indentation), newCommentText)
	
	// Generate the patch
	var builder strings.Builder
	builder.WriteString("--- file\n")
	builder.WriteString("+++ file\n")
	builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
		commentLine.LineNum+1, 1, 
		commentLine.LineNum+1, 1))
	builder.WriteString(fmt.Sprintf("-%s\n", pg.lines[commentLine.LineNum]))
	builder.WriteString(fmt.Sprintf("+%s\n", newCommentLine))
	
	return builder.String()
}

// generateRenameKeyPatch creates a patch that renames a key
func (pg *PatchGenerator) generateRenameKeyPatch() string {
	// Find keys that we can rename
	keyLines := make([]YAMLLine, 0)
	for _, line := range pg.parsedLines {
		if (line.LineType == LineTypeKey || line.LineType == LineTypeBlockStart) && line.Key != "" {
			keyLines = append(keyLines, line)
		}
	}
	
	if len(keyLines) == 0 {
		// Fall back to adding a value
		return pg.generateAddValuePatch()
	}
	
	// Pick a random key to rename
	keyLine := keyLines[rand.Intn(len(keyLines))]
	
	// Generate a new key name
	newKey := fmt.Sprintf("renamed_%s_%d", keyLine.Key, rand.Intn(100))
	
	// Build the new line with the same indentation
	var newLine string
	if keyLine.Value == "" {
		// This is a block start
		newLine = fmt.Sprintf("%s%s:", strings.Repeat(" ", keyLine.Indent), newKey)
	} else {
		// This is a key-value pair
		newLine = fmt.Sprintf("%s%s: %s", strings.Repeat(" ", keyLine.Indent), newKey, keyLine.Value)
	}
	
	// Generate the patch
	var builder strings.Builder
	builder.WriteString("--- file\n")
	builder.WriteString("+++ file\n")
	builder.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", 
		keyLine.LineNum+1, 1, 
		keyLine.LineNum+1, 1))
	builder.WriteString(fmt.Sprintf("-%s\n", pg.lines[keyLine.LineNum]))
	builder.WriteString(fmt.Sprintf("+%s\n", newLine))
	
	return builder.String()
}

// Helper functions

// findBlockStartLines returns all lines that start a block
func (pg *PatchGenerator) findBlockStartLines() []YAMLLine {
	blockLines := make([]YAMLLine, 0)
	for _, line := range pg.parsedLines {
		if line.LineType == LineTypeBlockStart {
			blockLines = append(blockLines, line)
		}
	}
	return blockLines
}

// findCommentLines returns all comment lines
func (pg *PatchGenerator) findCommentLines() []YAMLLine {
	commentLines := make([]YAMLLine, 0)
	for _, line := range pg.parsedLines {
		if line.LineType == LineTypeComment {
			commentLines = append(commentLines, line)
		}
	}
	return commentLines
}

// isNumeric checks if a string is a numeric value
func isNumeric(s string) bool {
	// Check for integers
	if _, err := fmt.Sscanf(s, "%d", new(int)); err == nil {
		return true
	}
	// Check for floats
	if _, err := fmt.Sscanf(s, "%f", new(float64)); err == nil {
		return true
	}
	return false
}

// Random comment templates
var commentTemplates = []string{
	"Configuration for %s",
	"Settings for %s environment",
	"Default values for %s",
	"TODO: Review %s settings",
	"FIXME: %s needs attention",
	"Required for %s functionality",
	"Controls how %s behaves",
	"Optional %s configuration",
	"%s settings - adjust as needed",
	"Recommended %s values",
}

// getRandomComment generates a random comment
func getRandomComment() string {
	template := getRandomItem(commentTemplates)
	subject := getRandomItem(randomNames)
	return fmt.Sprintf(template, subject)
}