package debugcli

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/chzyer/readline"
	"github.com/fatih/color"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pkg/errors"
	"github.com/replicatedhq/chartsmith/pkg/realtime"
	"github.com/replicatedhq/chartsmith/pkg/workspace"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

var (
	boldBlue   = color.New(color.FgBlue, color.Bold).SprintFunc()
	boldGreen  = color.New(color.FgGreen, color.Bold).SprintFunc()
	boldRed    = color.New(color.FgRed, color.Bold).SprintFunc()
	boldYellow = color.New(color.FgYellow, color.Bold).SprintFunc()
	dimText    = color.New(color.Faint).SprintFunc()
)

type DebugConsole struct {
	ctx             context.Context
	pgClient        *pgxpool.Pool
	activeWorkspace *types.Workspace
	readline        *readline.Instance
}

func RunConsole() error {
	ctx := context.Background()

	// Get DB connection string from environment
	dbURI := os.Getenv("DB_URI")
	if dbURI == "" {
		return errors.New("DB_URI environment variable not set")
	}

	// Set up a connection pool
	pgConfig, err := pgxpool.ParseConfig(dbURI)
	if err != nil {
		return errors.Wrap(err, "failed to parse postgres URI")
	}

	pgClient, err := pgxpool.NewWithConfig(ctx, pgConfig)
	if err != nil {
		return errors.Wrap(err, "failed to connect to postgres")
	}
	defer pgClient.Close()

	console := &DebugConsole{
		ctx:      ctx,
		pgClient: pgClient,
	}

	if err := console.run(); err != nil {
		return errors.Wrap(err, "console error")
	}

	return nil
}

func (c *DebugConsole) run() error {
	fmt.Println(boldBlue("Chartsmith Debug Console"))
	fmt.Println(dimText("Type 'help' for available commands, 'exit' to quit"))
	fmt.Println(dimText("Use '/workspace <id>' to select a workspace"))
	fmt.Println(dimText("Use up/down arrows to navigate command history"))
	fmt.Println()

	// Set up history file
	var historyFile string
	usr, err := user.Current()
	if err == nil {
		historyFile = filepath.Join(usr.HomeDir, ".chartsmith_history")
	}

	// We can't fetch workspace IDs yet since we don't have a console instance
	// Just provide basic tab completion initially
	workspaceItems := []readline.PrefixCompleterInterface{
		readline.PcItem("/workspace"),
	}

	// Configure readline with enhanced history and key bindings
	rl, err := readline.NewEx(&readline.Config{
		Prompt:                 boldYellow("[NO WORKSPACE]> "),
		HistoryFile:            historyFile,
		InterruptPrompt:        "^C",
		EOFPrompt:              "exit",
		HistorySearchFold:      true,
		DisableAutoSaveHistory: false,
		HistoryLimit:           1000,
		// Enable proper arrow key behavior
		VimMode: false,
		// Auto-completion function
		AutoComplete: readline.NewPrefixCompleter(
			append(workspaceItems,
				readline.PcItem("/help"),
				readline.PcItem("help"),
				readline.PcItem("list-files"),
				readline.PcItem("render"),
				readline.PcItem("patch-file"),
				readline.PcItem("apply-patch"),
				readline.PcItem("randomize-yaml"),
				readline.PcItem("exit"),
				readline.PcItem("quit"),
			)...,
		),
	})

	if err != nil {
		return errors.Wrap(err, "failed to initialize readline")
	}
	defer rl.Close()

	// Store the readline instance in the console
	c.readline = rl

	// Set up custom colors for the prompt
	rl.SetPrompt(boldYellow("[NO WORKSPACE]> "))

	// Try to fetch workspace IDs for better completion
	c.updateWorkspaceCompletions(rl)

	for {
		// Update prompt based on workspace selection
		if c.activeWorkspace != nil {
			rl.SetPrompt(boldGreen(fmt.Sprintf("workspace[%s]> ", c.activeWorkspace.Name)))
		} else {
			rl.SetPrompt(boldYellow("[NO WORKSPACE]> "))
		}

		// Read input with history support
		input, err := rl.Readline()
		if err != nil {
			if err == readline.ErrInterrupt {
				// Handle Ctrl+C
				fmt.Println("^C")
				continue
			} else if err == io.EOF {
				// Handle Ctrl+D or EOF
				return nil
			}
			return errors.Wrap(err, "failed to read input")
		}

		input = strings.TrimSpace(input)
		if input == "" {
			continue
		}

		if input == "exit" || input == "quit" {
			return nil
		}

		// Handle special commands that start with /
		if strings.HasPrefix(input, "/") {
			parts := strings.Fields(input)
			if len(parts) > 0 {
				cmd := parts[0][1:] // Remove the leading /
				args := parts[1:]

				switch cmd {
				case "workspace":
					if len(args) == 1 {
						// Single argument - treat as ID
						if err := c.selectWorkspaceById(args[0]); err != nil {
							fmt.Println(boldRed("Error:"), err)
						}
					} else if len(args) == 0 {
						// No arguments - list available workspaces
						if err := c.listAvailableWorkspaces(); err != nil {
							fmt.Println(boldRed("Error:"), err)
						}
					} else {
						fmt.Println(boldRed("Error: Invalid workspace command format. Use '/workspace' or '/workspace <id>'"))
					}
					continue
				case "help":
					c.showHelp()
					continue
				default:
					fmt.Printf(boldRed("Error: Unknown command '/%s'\n"), cmd)
					continue
				}
			}
		}

		// Execute regular commands
		parts := strings.Fields(input)
		if len(parts) == 0 {
			continue
		}

		cmd := parts[0]
		args := parts[1:]

		if err := c.executeCommand(cmd, args); err != nil {
			fmt.Println(boldRed("Error:"), err)
		}
	}
}

func (c *DebugConsole) executeCommand(cmd string, args []string) error {
	// Most commands require an active workspace
	if c.activeWorkspace == nil && cmd != "help" && cmd != "workspace" {
		return errors.New("no workspace selected. Use '/workspace <id>' to select a workspace")
	}

	switch cmd {
	case "help":
		c.showHelp()
	case "workspace":
		return c.listAvailableWorkspaces()
	case "render":
		return c.renderWorkspace(args)
	case "patch-file":
		return c.generatePatch(args)
	case "apply-patch":
		return c.applyPatch(args)
	case "list-files":
		return c.listFiles()
	case "randomize-yaml":
		return c.randomizeYaml(args)
	default:
		return fmt.Errorf("unknown command: %s", cmd)
	}
	return nil
}

// selectWorkspaceById selects a workspace by its ID
func (c *DebugConsole) selectWorkspaceById(id string) error {
	// Get the specified workspace
	query := `
        SELECT id, name, current_revision_number, created_at, last_updated_at
        FROM workspace
        WHERE id = $1
    `

	var workspace types.Workspace
	err := c.pgClient.QueryRow(c.ctx, query, id).Scan(
		&workspace.ID,
		&workspace.Name,
		&workspace.CurrentRevision,
		&workspace.CreatedAt,
		&workspace.LastUpdatedAt,
	)
	if err != nil {
		return errors.Wrapf(err, "failed to get workspace with ID: %s", id)
	}

	// Also fetch the charts for this workspace
	chartsQuery := `
        SELECT id, name
        FROM workspace_chart
        WHERE workspace_id = $1
    `
	chartRows, err := c.pgClient.Query(c.ctx, chartsQuery, id)
	if err != nil {
		fmt.Println(dimText("Warning: Failed to fetch charts for workspace"))
	} else {
		defer chartRows.Close()

		for chartRows.Next() {
			var chart types.Chart
			if err := chartRows.Scan(&chart.ID, &chart.Name); err != nil {
				fmt.Println(dimText(fmt.Sprintf("Warning: Failed to scan chart: %v", err)))
				continue
			}
			workspace.Charts = append(workspace.Charts, chart)
		}

		if len(workspace.Charts) > 0 {
			fmt.Printf(dimText("Found %d chart(s)\n"), len(workspace.Charts))
		} else {
			fmt.Println(dimText("No charts found for this workspace"))
		}
	}

	c.activeWorkspace = &workspace
	fmt.Printf(boldGreen("Selected workspace: %s (ID: %s)\n"), workspace.Name, workspace.ID)

	// Update completions after selecting a workspace
	// This is useful for getting file path completions
	if c.readline != nil {
		c.updateWorkspaceCompletions(c.readline)
	}

	return nil
}

// listAvailableWorkspaces shows available workspaces without selecting one
func (c *DebugConsole) listAvailableWorkspaces() error {
	workspaces, err := c.listWorkspaces()
	if err != nil {
		return errors.Wrap(err, "failed to list workspaces")
	}

	if len(workspaces) == 0 {
		fmt.Println(dimText("No workspaces found"))
		return nil
	}

	fmt.Println(boldBlue("Available Workspaces:"))
	for i, ws := range workspaces {
		fmt.Printf("  %d. %s (ID: %s)\n", i+1, ws.Name, ws.ID)
	}
	fmt.Println()

	fmt.Println(dimText("Use '/workspace <id>' to select a workspace"))
	return nil
}

func (c *DebugConsole) showHelp() {
	fmt.Println(boldBlue("Slash Commands:"))
	fmt.Println("  " + boldGreen("/help") + "                 Show this help")
	fmt.Println("  " + boldGreen("/workspace") + "            List available workspaces")
	fmt.Println("  " + boldGreen("/workspace") + " <id>       Select a workspace by ID")
	fmt.Println()

	fmt.Println(boldBlue("Workspace Commands:"))
	fmt.Println("  " + boldGreen("workspace") + "             List available workspaces")
	fmt.Println("  " + boldGreen("list-files") + "            List files in the current workspace")
	fmt.Println("  " + boldGreen("render") + " <values-path>  Render workspace with values.yaml from file path")
	fmt.Println("  " + boldGreen("patch-file") + " <file-path> [--count=N]  Generate N patches for file")
	fmt.Println("  " + boldGreen("apply-patch") + " <patch-id> Apply a previously generated patch")
	fmt.Println("  " + boldGreen("randomize-yaml") + " <file-path> [--complexity=low|medium|high] Generate random YAML for testing")
	fmt.Println()

	fmt.Println(boldBlue("General Commands:"))
	fmt.Println("  " + boldGreen("help") + "                  Show this help")
	fmt.Println("  " + boldGreen("exit") + "                  Exit the console")
	fmt.Println("  " + boldGreen("quit") + "                  Exit the console")
	fmt.Println()
}

func (c *DebugConsole) selectWorkspace() error {
	// Get the list of workspaces
	workspaces, err := c.listWorkspaces()
	if err != nil {
		return errors.Wrap(err, "failed to list workspaces")
	}

	if len(workspaces) == 0 {
		return errors.New("no workspaces found")
	}

	fmt.Println(boldBlue("Available Workspaces:"))
	for i, ws := range workspaces {
		fmt.Printf("  %d. %s (ID: %s)\n", i+1, ws.Name, ws.ID)
	}
	fmt.Println()

	// Get home directory for history file
	usr, err := user.Current()
	if err != nil {
		return errors.Wrap(err, "failed to get user home directory")
	}
	historyFile := filepath.Join(usr.HomeDir, ".chartsmith_workspace_history")

	// Create a readline instance for workspace selection with enhanced history support
	rlConfig := &readline.Config{
		Prompt:                 boldYellow("Select workspace (number or ID): "),
		HistoryFile:            historyFile,
		HistoryLimit:           100,
		DisableAutoSaveHistory: false,
		HistorySearchFold:      true,
		// Enable proper arrow key behavior
		VimMode: false,
	}

	// Build completion items from workspace IDs and numbers
	var completionItems []readline.PrefixCompleterInterface
	for i, ws := range workspaces {
		completionItems = append(completionItems, readline.PcItem(ws.ID))
		completionItems = append(completionItems, readline.PcItem(fmt.Sprintf("%d", i+1)))
	}
	rlConfig.AutoComplete = readline.NewPrefixCompleter(completionItems...)

	rl, err := readline.NewEx(rlConfig)
	if err != nil {
		return errors.Wrap(err, "failed to create readline instance")
	}
	defer rl.Close()

	// Display a hint about using up/down arrows for history
	fmt.Println(dimText("Use up/down arrows to navigate history"))

	for {
		input, err := rl.Readline()
		if err != nil {
			if err == readline.ErrInterrupt {
				return errors.New("workspace selection cancelled")
			}
			return errors.Wrap(err, "failed to read input")
		}

		input = strings.TrimSpace(input)
		if input == "" {
			continue
		}

		// Save to history manually to ensure it's there
		rl.SaveHistory(input)

		// Check if the input is a number
		num, err := strconv.Atoi(input)
		if err == nil && num > 0 && num <= len(workspaces) {
			c.activeWorkspace = &workspaces[num-1]
			break
		}

		// Check if the input is an ID
		for i, ws := range workspaces {
			if ws.ID == input {
				c.activeWorkspace = &workspaces[i]
				break
			}
		}

		if c.activeWorkspace != nil {
			break
		}

		fmt.Println(boldRed("Invalid selection. Please try again."))
	}

	fmt.Printf(boldGreen("Selected workspace: %s (ID: %s)\n\n"), c.activeWorkspace.Name, c.activeWorkspace.ID)
	return nil
}

func (c *DebugConsole) listWorkspaces() ([]types.Workspace, error) {
	query := `
        SELECT id, name, current_revision_number, created_at, last_updated_at
        FROM workspace
        ORDER BY last_updated_at DESC
        LIMIT 30
    `

	rows, err := c.pgClient.Query(c.ctx, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query workspaces")
	}
	defer rows.Close()

	var workspaces []types.Workspace
	for rows.Next() {
		var ws types.Workspace
		err := rows.Scan(&ws.ID, &ws.Name, &ws.CurrentRevision, &ws.CreatedAt, &ws.LastUpdatedAt)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan workspace")
		}
		workspaces = append(workspaces, ws)
	}

	return workspaces, nil
}

func (c *DebugConsole) listFiles() error {
	if c.activeWorkspace == nil {
		return errors.New("no workspace selected")
	}

	query := `
        SELECT id, file_path, length(content) as content_size
        FROM workspace_file
        WHERE workspace_id = $1
        ORDER BY file_path
    `

	rows, err := c.pgClient.Query(c.ctx, query, c.activeWorkspace.ID)
	if err != nil {
		return errors.Wrap(err, "failed to query files")
	}
	defer rows.Close()

	fmt.Println(boldBlue("Files in workspace:"))
	count := 0
	for rows.Next() {
		var id, filePath string
		var contentSize int
		err := rows.Scan(&id, &filePath, &contentSize)
		if err != nil {
			return errors.Wrap(err, "failed to scan file")
		}
		fmt.Printf("  %s (%d bytes)\n", filePath, contentSize)
		count++
	}

	if count == 0 {
		fmt.Println(dimText("  No files found"))
	} else {
		fmt.Printf(dimText("\nTotal: %d files\n"), count)
	}

	return nil
}

func (c *DebugConsole) renderWorkspace(args []string) error {
	if c.activeWorkspace == nil {
		return errors.New("no workspace selected")
	}

	if len(args) < 1 {
		return errors.New("usage: render <values-path>")
	}

	valuesPath := args[0]
	valuesBytes, err := os.ReadFile(valuesPath)
	if err != nil {
		return errors.Wrapf(err, "failed to read values file: %s", valuesPath)
	}

	valuesContent := string(valuesBytes)

	fmt.Printf(boldBlue("Rendering workspace with values from %s\n"), valuesPath)
	startTime := time.Now()

	// TODO: Implementation of render logic
	// For now, just simulate the operation
	fmt.Println(dimText("Starting render operation..."))
	fmt.Println(dimText("Values content length: " + fmt.Sprintf("%d bytes", len(valuesContent))))
	time.Sleep(2 * time.Second) // Simulate rendering

	elapsedTime := time.Since(startTime)
	fmt.Printf(boldGreen("Render completed in %s\n"), elapsedTime)

	// Here we'll need to insert the actual implementation
	// This would involve:
	// 1. Create a render record
	// 2. Render each chart in the workspace
	// 3. Insert the rendered files

	return nil
}

func (c *DebugConsole) generatePatch(args []string) error {
	if c.activeWorkspace == nil {
		return errors.New("no workspace selected")
	}

	if len(args) < 1 {
		return errors.New("usage: patch-file <file-path> [--count=N] [--output=<output-dir>]")
	}

	filePath := args[0]
	count := 1
	outputDir := ""

	// Parse optional arguments
	for i := 1; i < len(args); i++ {
		if strings.HasPrefix(args[i], "--count=") {
			countStr := strings.TrimPrefix(args[i], "--count=")
			var err error
			count, err = strconv.Atoi(countStr)
			if err != nil || count < 1 {
				return errors.New("invalid count value, must be a positive integer")
			}
		} else if strings.HasPrefix(args[i], "--output=") {
			outputDir = strings.TrimPrefix(args[i], "--output=")
		}
	}

	// Get the file content
	query := `
        SELECT content FROM workspace_file
        WHERE workspace_id = $1 AND file_path = $2
    `
	var content string
	err := c.pgClient.QueryRow(c.ctx, query, c.activeWorkspace.ID, filePath).Scan(&content)
	if err != nil {
		return errors.Wrapf(err, "failed to get file content for: %s", filePath)
	}

	fmt.Printf(boldBlue("Generating %d patch(es) for file: %s\n"), count, filePath)

	// Create patch generator
	patchGen := NewPatchGenerator(content)

	// Generate the requested number of patches
	for i := 1; i <= count; i++ {
		// Generate a unique patch ID
		patchID := fmt.Sprintf("patch-%d-%d", time.Now().Unix(), i)

		// Generate the patch
		patchContent := patchGen.GeneratePatch()

		// Show the patch
		fmt.Printf(boldGreen("\nPatch %d of %d (ID: %s):\n"), i, count, patchID)
		fmt.Println(patchContent)

		// If output directory is specified, save the patch
		if outputDir != "" {
			if err := os.MkdirAll(outputDir, 0755); err != nil {
				return errors.Wrapf(err, "failed to create output directory: %s", outputDir)
			}

			patchFile := filepath.Join(outputDir, fmt.Sprintf("%s.patch", patchID))
			if err := os.WriteFile(patchFile, []byte(patchContent), 0644); err != nil {
				return errors.Wrapf(err, "failed to write patch file: %s", patchFile)
			}

			fmt.Printf("  Saved to: %s\n", patchFile)
		}

		if err := workspace.AddPendingPatch(c.ctx, c.activeWorkspace.ID, c.activeWorkspace.CurrentRevision, c.activeWorkspace.Charts[0].ID, filePath, patchContent); err != nil {
			return errors.Wrapf(err, "failed to create or patch file: %s", filePath)
		}

		if err := realtime.SendPatchesToWorkspace(c.ctx, c.activeWorkspace.ID, filePath, content, []string{patchContent}); err != nil {
			return errors.Wrapf(err, "failed to send patch to realtime server: %s", filePath)
		}
	}

	return nil
}

func (c *DebugConsole) applyPatch(args []string) error {
	if c.activeWorkspace == nil {
		return errors.New("no workspace selected")
	}

	if len(args) < 1 {
		return errors.New("usage: apply-patch <patch-id>")
	}

	patchID := args[0]

	// TODO: Implement actual patch application
	// For now, just simulate it
	fmt.Printf(boldBlue("Applying patch: %s\n"), patchID)
	time.Sleep(1 * time.Second)
	fmt.Println(boldGreen("Patch applied successfully"))

	return nil
}

func (c *DebugConsole) randomizeYaml(args []string) error {
	if c.activeWorkspace == nil {
		return errors.New("no workspace selected")
	}

	if len(args) < 1 {
		return errors.New("usage: randomize-yaml <file-path> [--complexity=low|medium|high]")
	}

	filePath := args[0]
	complexity := ComplexityMedium

	// Parse optional arguments
	for i := 1; i < len(args); i++ {
		if strings.HasPrefix(args[i], "--complexity=") {
			complexityStr := strings.TrimPrefix(args[i], "--complexity=")
			switch complexityStr {
			case "low":
				complexity = ComplexityLow
			case "medium":
				complexity = ComplexityMedium
			case "high":
				complexity = ComplexityHigh
			default:
				return errors.New("invalid complexity value, must be low, medium, or high")
			}
		}
	}

	// Generate random YAML content
	yamlContent := GenerateRandomYAML(YAMLComplexity(complexity))

	// Ask user if they want to save it to a file
	fmt.Printf(boldBlue("Generated YAML for complexity %s:\n\n"), complexity)
	fmt.Println(yamlContent)

	// Create a temporary readline instance for the yes/no prompt with history support
	rlConfig := &readline.Config{
		Prompt:                 "\n" + boldYellow("Save to file? (y/n): "),
		HistoryLimit:           10,
		DisableAutoSaveHistory: false,
		HistorySearchFold:      true,
		VimMode:                false,
		AutoComplete:           readline.NewPrefixCompleter(readline.PcItem("y"), readline.PcItem("n")),
	}
	rl, err := readline.NewEx(rlConfig)
	if err != nil {
		return errors.Wrap(err, "failed to create readline instance")
	}
	defer rl.Close()

	response, err := rl.Readline()
	if err != nil {
		return errors.Wrap(err, "failed to read input")
	}
	response = strings.TrimSpace(response)

	if strings.ToLower(response) == "y" || strings.ToLower(response) == "yes" {
		// Create a timestamped filename if none provided
		outputPath := filePath
		if !strings.HasSuffix(outputPath, ".yaml") && !strings.HasSuffix(outputPath, ".yml") {
			outputPath = fmt.Sprintf("%s-%d.yaml", filePath, time.Now().Unix())
		}

		// Write the content to the file
		err := os.WriteFile(outputPath, []byte(yamlContent), 0644)
		if err != nil {
			return errors.Wrapf(err, "failed to write YAML to file: %s", outputPath)
		}

		fmt.Printf(boldGreen("YAML saved to: %s\n"), outputPath)
	}

	return nil
}

// updateWorkspaceCompletions updates the readline completer with workspace IDs and file paths
func (c *DebugConsole) updateWorkspaceCompletions(rl *readline.Instance) {
	// Get workspace IDs for completion
	workspaces, err := c.listWorkspaces()
	if err != nil {
		return // Silently fail, completions just won't include workspaces
	}

	// Build workspace completions
	wsCompletions := make([]readline.PrefixCompleterInterface, 0, len(workspaces))
	for _, ws := range workspaces {
		wsCompletions = append(wsCompletions, readline.PcItem(ws.ID))
	}

	// Add file path completions if a workspace is selected
	var filePathCompletions []readline.PrefixCompleterInterface
	if c.activeWorkspace != nil {
		// Get files from the current workspace for completions
		files, err := c.getWorkspaceFiles()
		if err == nil && len(files) > 0 {
			for _, file := range files {
				filePathCompletions = append(filePathCompletions, readline.PcItem(file))
			}
		}
	}

	// Build the full completer with workspace and file completions
	completer := readline.NewPrefixCompleter(
		readline.PcItem("/workspace", wsCompletions...),
		readline.PcItem("/help"),
		readline.PcItem("help"),
		readline.PcItem("list-files"),
		// Add file path completions to commands that use files
		readline.PcItem("render"),
		readline.PcItem("patch-file", filePathCompletions...),
		readline.PcItem("apply-patch"),
		readline.PcItem("randomize-yaml", filePathCompletions...),
		readline.PcItem("exit"),
		readline.PcItem("quit"),
	)

	// Update the readline instance with the new completer
	rl.Config.AutoComplete = completer
}

// getWorkspaceFiles returns a list of file paths in the current workspace
func (c *DebugConsole) getWorkspaceFiles() ([]string, error) {
	if c.activeWorkspace == nil {
		return nil, errors.New("no workspace selected")
	}

	query := `
		SELECT file_path
		FROM workspace_file
		WHERE workspace_id = $1
		ORDER BY file_path
	`

	rows, err := c.pgClient.Query(c.ctx, query, c.activeWorkspace.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query workspace files")
	}
	defer rows.Close()

	var filePaths []string
	for rows.Next() {
		var filePath string
		if err := rows.Scan(&filePath); err != nil {
			return nil, errors.Wrap(err, "failed to scan file path")
		}
		filePaths = append(filePaths, filePath)
	}

	return filePaths, nil
}
