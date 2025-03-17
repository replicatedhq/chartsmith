package debugcli

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/chzyer/readline"
	"github.com/fatih/color"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pkg/errors"
	"github.com/replicatedhq/chartsmith/pkg/logger"
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
	
	// To track double Ctrl+C for exit
	lastInterrupt *time.Time
)

// ConsoleOptions defines configuration options for the debug console
type ConsoleOptions struct {
	WorkspaceID    string   // Workspace ID to use for commands
	NonInteractive bool     // If true, run in non-interactive mode (execute command and exit)
	Command        []string // Command to execute in non-interactive mode
}

// DebugConsole represents the debug console state
type DebugConsole struct {
	ctx             context.Context
	pgClient        *pgxpool.Pool
	activeWorkspace *types.Workspace
	readline        *readline.Instance
	options         ConsoleOptions
}

// RunConsole initializes and runs the debug console with the given options
func RunConsole(options ConsoleOptions) error {
	logger.SetDebug()
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
		options:  options,
	}

	// If workspace ID is provided, select it first
	if options.WorkspaceID != "" {
		if err := console.selectWorkspaceById(options.WorkspaceID); err != nil {
			return errors.Wrapf(err, "failed to select workspace with ID %s", options.WorkspaceID)
		}
	}
	
	if options.NonInteractive {
		// Execute a single command and exit
		if len(options.Command) == 0 {
			return errors.New("no command specified in non-interactive mode")
		}
		
		if console.activeWorkspace == nil && options.WorkspaceID == "" {
			return errors.New("workspace ID is required for non-interactive mode")
		}
		
		return console.executeNonInteractiveCommand(options.Command)
	}

	// Run in interactive mode
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
	fmt.Println(dimText("Press Ctrl+C twice in quick succession to exit"))
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
		readline.PcItem("/new-revision"),
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
				// Check if we've seen a Ctrl+C recently
				if lastInterrupt != nil && time.Since(*lastInterrupt) < 2*time.Second {
					fmt.Println("Exiting...")
					return nil
				}
				// Record this interrupt
				now := time.Now()
				lastInterrupt = &now
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
				case "new-revision":
					if c.activeWorkspace == nil {
						fmt.Println(boldRed("Error: No workspace selected. Use '/workspace <id>' to select a workspace"))
					} else {
						if err := c.createNewRevision(); err != nil {
							fmt.Println(boldRed("Error:"), err)
						}
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

// executeNonInteractiveCommand handles execution of a command in non-interactive mode
func (c *DebugConsole) executeNonInteractiveCommand(args []string) error {
	if len(args) == 0 {
		return errors.New("no command specified")
	}
	
	cmd := args[0]
	cmdArgs := []string{}
	if len(args) > 1 {
		cmdArgs = args[1:]
	}
	
	// Filter out any flags that were already processed by cobra (like --workspace-id)
	filteredArgs := []string{}
	for _, arg := range cmdArgs {
		if !strings.HasPrefix(arg, "--workspace-id=") && arg != "--workspace-id" {
			filteredArgs = append(filteredArgs, arg)
		}
	}
	
	// Skip the next arg if it's the value for --workspace-id
	for i := 0; i < len(filteredArgs); i++ {
		if filteredArgs[i] == "--workspace-id" && i+1 < len(filteredArgs) {
			filteredArgs = append(filteredArgs[:i], filteredArgs[i+2:]...)
			break
		}
	}
	
	return c.executeCommand(cmd, filteredArgs)
}

func (c *DebugConsole) executeCommand(cmd string, args []string) error {
	// Most commands require an active workspace
	if c.activeWorkspace == nil && cmd != "help" && cmd != "workspace" {
		if c.options.NonInteractive {
			return errors.New("workspace ID is required. Use --workspace-id flag")
		}
		return errors.New("no workspace selected. Use '/workspace <id>' to select a workspace")
	}

	switch cmd {
	case "help":
		c.showHelp()
	case "workspace":
		return c.listAvailableWorkspaces()
	case "new-revision":
		return c.createNewRevision()
	case "render":
		return c.renderWorkspace(args)
	case "patch-file":
		// Check if current revision is complete before allowing patches
		isComplete, err := c.isCurrentRevisionComplete()
		if err != nil {
			return errors.Wrap(err, "failed to check if current revision is complete")
		}
		if isComplete {
			return errors.New("cannot generate patches for completed revision. Use 'new-revision' command first")
		}
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
		if !c.options.NonInteractive {
			fmt.Println(dimText("Warning: Failed to fetch charts for workspace"))
		}
	} else {
		defer chartRows.Close()

		for chartRows.Next() {
			var chart types.Chart
			if err := chartRows.Scan(&chart.ID, &chart.Name); err != nil {
				if !c.options.NonInteractive {
					fmt.Println(dimText(fmt.Sprintf("Warning: Failed to scan chart: %v", err)))
				}
				continue
			}
			workspace.Charts = append(workspace.Charts, chart)
		}

		if !c.options.NonInteractive {
			if len(workspace.Charts) > 0 {
				fmt.Printf(dimText("Found %d chart(s)\n"), len(workspace.Charts))
			} else {
				fmt.Println(dimText("No charts found for this workspace"))
			}
		}
	}

	c.activeWorkspace = &workspace
	
	if !c.options.NonInteractive {
		fmt.Printf(boldGreen("Selected workspace: %s (ID: %s)\n"), workspace.Name, workspace.ID)
	}

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
	// Skip standard help in non-interactive mode, just show command-specific help
	if c.options.NonInteractive {
		// For now, just return as we'll implement command-specific help later
		return
	}

	fmt.Println(boldBlue("Slash Commands:"))
	fmt.Println("  " + boldGreen("/help") + "                 Show this help")
	fmt.Println("  " + boldGreen("/workspace") + "            List available workspaces")
	fmt.Println("  " + boldGreen("/workspace") + " <id>       Select a workspace by ID")
	fmt.Println("  " + boldGreen("/new-revision") + "         Create a new revision for the current workspace")
	fmt.Println()

	fmt.Println(boldBlue("Workspace Commands:"))
	fmt.Println("  " + boldGreen("workspace") + "             List available workspaces")
	fmt.Println("  " + boldGreen("new-revision") + "          Create a new revision for the current workspace")
	fmt.Println("  " + boldGreen("list-files") + "            List files in the current workspace")
	fmt.Println("  " + boldGreen("render") + " <values-path>  Render workspace with values.yaml from file path")
	fmt.Println("  " + boldGreen("patch-file") + " <file-path> [--count=N] [--output=<dir>]  Generate N patches for file (requires incomplete revision)")
	fmt.Println("  " + boldGreen("apply-patch") + " <patch-id> Apply a previously generated patch")
	fmt.Println("  " + boldGreen("randomize-yaml") + " <file-path> [--complexity=low|medium|high] Generate random YAML for testing")
	fmt.Println()

	fmt.Println(boldBlue("General Commands:"))
	fmt.Println("  " + boldGreen("help") + "                  Show this help")
	fmt.Println("  " + boldGreen("exit") + "                  Exit the console")
	fmt.Println("  " + boldGreen("quit") + "                  Exit the console")
	fmt.Println()
	
	fmt.Println(boldBlue("Command-line Usage:"))
	fmt.Println("  These commands can also be run directly from the command line:")
	fmt.Println("  " + boldGreen("debug-console new-revision --workspace-id <id>"))
	fmt.Println("  " + boldGreen("debug-console patch-file values.yaml --workspace-id <id> [--count=N] [--output=<dir>]"))
	fmt.Println("  " + boldGreen("debug-console render values.yaml --workspace-id <id>"))
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
	// Always use diff -u format
	useDiffU := true

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

		// If requested, use Unix diff -u format
		if useDiffU {
			// Create temporary files for original and modified content
			tmpDir, err := os.MkdirTemp("", "chartsmith-patch")
			if err != nil {
				return errors.Wrap(err, "failed to create temp directory")
			}
			defer os.RemoveAll(tmpDir)

			// Parse the existing patch to determine what the modified content should be
			originalFile := filepath.Join(tmpDir, "original")
			modifiedFile := filepath.Join(tmpDir, "modified")

			if err := os.WriteFile(originalFile, []byte(content), 0644); err != nil {
				return errors.Wrap(err, "failed to write original content")
			}

			// Create a temp file for the patch
			tempPatchFile := filepath.Join(tmpDir, "patch.txt")
			if err := os.WriteFile(tempPatchFile, []byte(patchContent), 0644); err != nil {
				return errors.Wrap(err, "failed to write temp patch file")
			}

			// Copy original content to the modified file initially
			if err := os.WriteFile(modifiedFile, []byte(content), 0644); err != nil {
				return errors.Wrap(err, "failed to write modified content")
			}

			// Apply the patch using GNU patch command
			patchCmd := fmt.Sprintf("cd %s && patch -u %s < %s 2>/dev/null || true", 
				tmpDir, filepath.Base(modifiedFile), filepath.Base(tempPatchFile))
				
			logger.Debug("Running patch command", logger.Any("cmd", patchCmd))
			patchExec := exec.Command("bash", "-c", patchCmd)
			if patchErr := patchExec.Run(); patchErr != nil {
				logger.Debug("Patch command exited with error, continuing anyway", logger.Err(patchErr))
			}

			// Run diff -u to generate a proper unified diff
			diffOutFile := filepath.Join(tmpDir, "diff.patch")
			diffCmd := fmt.Sprintf("diff -u %s %s > %s 2>/dev/null || true", 
				originalFile, modifiedFile, diffOutFile)
			
			cmd := exec.Command("bash", "-c", diffCmd)
			if err := cmd.Run(); err != nil {
				// Ignore diff exit code, it returns non-zero if files differ
				logger.Debug("Diff command exited with error, this is normal", logger.Err(err))
			}

			// Read the generated diff
			diffBytes, err := os.ReadFile(diffOutFile)
			if err != nil {
				return errors.Wrap(err, "failed to read diff output")
			}

			// Replace the original patch with the diff output, but with proper filenames
			if len(diffBytes) > 0 {
				logger.Debug("Using diff -u output for patch", logger.Any("length", len(diffBytes)))
				
				// Process the diff to replace temp filenames with the actual filename
				diffLines := strings.Split(string(diffBytes), "\n")
				
				// Replace the temp file paths in the diff output with the actual file path
				// This ensures the patch uses the original file path provided by the user
				for i := 0; i < len(diffLines); i++ {
					// Process all lines that might contain the temp file paths
					if i < 2 {
						// First two lines are special header lines with filenames
						if i == 0 && strings.HasPrefix(diffLines[i], "--- ") {
							// First line is the original file
							diffLines[i] = fmt.Sprintf("--- %s", filePath)
						} else if i == 1 && strings.HasPrefix(diffLines[i], "+++ ") {
							// Second line is the modified file
							diffLines[i] = fmt.Sprintf("+++ %s", filePath)
						}
					} else {
						// For other lines, replace any instances of the temp file paths
						// This handles cases where the file path might appear in chunk headers or context
						diffLines[i] = strings.ReplaceAll(diffLines[i], originalFile, filePath)
						diffLines[i] = strings.ReplaceAll(diffLines[i], modifiedFile, filePath)
					}
				}
				
				patchContent = strings.Join(diffLines, "\n")
			} else {
				logger.Debug("diff -u produced no output, using original patch")
				
				// Try to manually format the patch to make it more like a standard diff -u
				// This is a simplistic approach, real-world patches need proper parsing
				patchContent = formatAsDiffU(patchContent, filePath)
			}
		}

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
		readline.PcItem("/new-revision"),
		readline.PcItem("/help"),
		readline.PcItem("help"),
		readline.PcItem("new-revision"),
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

// createNewRevision creates a new workspace revision
func (c *DebugConsole) createNewRevision() error {
	if c.activeWorkspace == nil {
		return errors.New("no workspace selected")
	}

	workspaceID := c.activeWorkspace.ID
	var currentRevisionNumber int = c.activeWorkspace.CurrentRevision

	fmt.Printf(boldBlue("Creating new revision for workspace %s (current revision: %d)\n"),
		c.activeWorkspace.Name, currentRevisionNumber)

	// Start transaction
	tx, err := c.pgClient.Begin(c.ctx)
	if err != nil {
		return errors.Wrap(err, "failed to begin transaction")
	}
	defer tx.Rollback(c.ctx) // Will be ignored if tx.Commit() is called

	// Get next revision number
	var newRevisionNumber int
	err = tx.QueryRow(c.ctx, `
		WITH latest_revision AS (
			SELECT * FROM workspace_revision
			WHERE workspace_id = $1
			ORDER BY revision_number DESC
			LIMIT 1
		),
		next_revision AS (
			SELECT COALESCE(MAX(revision_number), 0) + 1 as next_num
			FROM workspace_revision
			WHERE workspace_id = $1
		)
		INSERT INTO workspace_revision (
			workspace_id, revision_number, created_at,
			created_by_user_id, created_type, is_complete, is_rendered, plan_id
		)
		SELECT
			$1,
			next_num,
			NOW(),
			'debug-console', -- created by debug console
			'manual',        -- manual creation
			false,           -- not complete
			false,           -- not rendered
			NULL             -- no plan
		FROM next_revision
		LEFT JOIN latest_revision lr ON true
		RETURNING revision_number
	`, workspaceID).Scan(&newRevisionNumber)
	if err != nil {
		return errors.Wrap(err, "failed to create revision record")
	}

	previousRevisionNumber := newRevisionNumber - 1

	// Copy workspace_chart records from previous revision
	result, err := tx.Exec(c.ctx, `
		INSERT INTO workspace_chart (id, revision_number, workspace_id, name)
		SELECT id, $1, workspace_id, name
		FROM workspace_chart
		WHERE workspace_id = $2 AND revision_number = $3
	`, newRevisionNumber, workspaceID, previousRevisionNumber)
	if err != nil {
		return errors.Wrap(err, "failed to copy chart records")
	}
	chartRowsAffected := result.RowsAffected()

	// Copy workspace_file records from previous revision
	result, err = tx.Exec(c.ctx, `
		INSERT INTO workspace_file (
			id, revision_number, chart_id, workspace_id, file_path,
			content, embeddings
		)
		SELECT
			id, $1, chart_id, workspace_id, file_path,
			content, embeddings
		FROM workspace_file
		WHERE workspace_id = $2 AND revision_number = $3
	`, newRevisionNumber, workspaceID, previousRevisionNumber)
	if err != nil {
		return errors.Wrap(err, "failed to copy file records")
	}
	fileRowsAffected := result.RowsAffected()

	// Update workspace current revision
	_, err = tx.Exec(c.ctx, `
		UPDATE workspace
		SET current_revision_number = $1
		WHERE id = $2
	`, newRevisionNumber, workspaceID)
	if err != nil {
		return errors.Wrap(err, "failed to update workspace revision number")
	}

	// Commit transaction
	err = tx.Commit(c.ctx)
	if err != nil {
		return errors.Wrap(err, "failed to commit transaction")
	}

	// Update local workspace revision number
	c.activeWorkspace.CurrentRevision = newRevisionNumber

	fmt.Printf(boldGreen("Created new revision %d - copied %d charts and %d files\n"),
		newRevisionNumber, chartRowsAffected, fileRowsAffected)
	fmt.Println(dimText("Revision is not marked as complete, and will not be rendered."))
	fmt.Println(dimText("Use normal UI or API to set revision complete and trigger rendering."))

	return nil
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

// isCurrentRevisionComplete checks if the current revision is marked as complete
func (c *DebugConsole) isCurrentRevisionComplete() (bool, error) {
	if c.activeWorkspace == nil {
		return false, errors.New("no workspace selected")
	}

	workspaceID := c.activeWorkspace.ID
	revisionNumber := c.activeWorkspace.CurrentRevision

	var isComplete bool
	err := c.pgClient.QueryRow(c.ctx, `
		SELECT is_complete
		FROM workspace_revision
		WHERE workspace_id = $1 AND revision_number = $2
	`, workspaceID, revisionNumber).Scan(&isComplete)

	if err != nil {
		return false, errors.Wrapf(err, "failed to check if revision %d is complete", revisionNumber)
	}

	return isComplete, nil
}

// formatAsDiffU formats a patch to match standard diff -u format
func formatAsDiffU(patch string, filePath string) string {
	// If it already has --- and +++ headers, just ensure they use the correct file path
	if strings.Contains(patch, "---") && strings.Contains(patch, "+++") {
		lines := strings.Split(patch, "\n")
		for i, line := range lines {
			if i == 0 && strings.HasPrefix(line, "--- ") {
				lines[i] = fmt.Sprintf("--- %s", filePath)
			} else if i == 1 && strings.HasPrefix(line, "+++ ") {
				lines[i] = fmt.Sprintf("+++ %s", filePath)
			}
		}
		return strings.Join(lines, "\n")
	}
	
	// Very simple reformatting - in a real implementation you would need
	// to properly parse and reconstruct the patch
	var sb strings.Builder
	
	// Add standard diff -u headers with the correct file path
	sb.WriteString("--- " + filePath + "\n")
	sb.WriteString("+++ " + filePath + "\n")
	
	// Add the original patch content, preserving any @@ headers
	sb.WriteString(patch)
	
	return sb.String()
}