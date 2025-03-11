"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useAtom } from "jotai";
import { Check, X, ChevronUp, ChevronDown, CheckCheck, ChevronRight } from "lucide-react";

// atoms
import { selectedFileAtom, currentDiffIndexAtom, updateCurrentDiffIndexAtom, updateFileContentAtom } from "@/atoms/workspace";
import { allFilesBeforeApplyingPendingPatchesAtom, allFilesWithPendingPatchesAtom, workspaceAtom, addFileToWorkspaceAtom } from "@/atoms/workspace";

// types
import type { editor } from "monaco-editor";
import Editor from "@monaco-editor/react";
import type { WorkspaceFile } from "@/lib/types/workspace";

// hooks
import { useMonacoEditor } from "@/hooks/useMonacoEditor";

// Already imported useEffect above

// actions
import { rejectPatchAction, rejectAllPatchesAction } from "@/lib/workspace/actions/reject-patch";
import { acceptPatchAction, acceptAllPatchesAction } from "@/lib/workspace/actions/accept-patch";

// types
import type { Session } from "@/lib/types/session";

interface CodeEditorProps {
  session: Session;
  theme?: "light" | "dark";
  readOnly?: boolean;
  onCommandK?: () => void;
}

// Extend the Window interface to include our custom properties
declare global {
  interface Window {
    __monaco?: any;
    __monacoEditor?: editor.IStandaloneCodeEditor;
    __monacoModels?: {
      [key: string]: editor.ITextModel;
    };
  }
}

// Ultra simple and reliable diff parser that extracts only the final content
function parseDiff(originalContent: string, diffContent: string): string {
  // For empty diffs, return original content
  if (!diffContent || diffContent.trim() === '') {
    return originalContent;
  }

  // For new files (empty original content), extract only the added lines
  if (originalContent === '' || diffContent.includes('@@ -0,0 +1,')) {
    const newContent = diffContent
      .split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.substring(1))
      .join('\n');

    if (newContent) {
      return newContent;
    }
  }

  // Direct text replacement for common fixes
  // Handle specific line replacements in YAML/JSON
  const replacementMatches = Array.from(diffContent.matchAll(/-([^:\n]+):\s*([^\n]+)\n\+([^:\n]+):\s*([^\n]+)/g));
  if (replacementMatches.length === 1) {
    const match = replacementMatches[0];
    const oldKey = match[1].trim();
    const oldValue = match[2].trim();
    const newKey = match[3].trim();
    const newValue = match[4].trim();

    // If it's a direct value replacement (same key)
    if (oldKey === newKey) {
      const searchPattern = `${oldKey}: ${oldValue}`;
      const replacement = `${newKey}: ${newValue}`;
      if (originalContent.includes(searchPattern)) {
        return originalContent.replace(searchPattern, replacement);
      }
    }
  }

  try {
    // Last resort: extract the entire modified file content directly
    // Look for a complete rendered version in the diff
    // Using multiline flag (.*)+ pattern instead of dotAll flag (s) for compatibility
    const completeDiffMatch = diffContent.match(/\n--- [\s\S]*?\n\+\+\+ [\s\S]*?\n((?:@@ [\s\S]*? @@[\s\S]*?\n)+)((?: [\s\S]*\n|\+[\s\S]*\n|-[\s\S]*\n)*)/);
    if (completeDiffMatch) {
      const hunks = completeDiffMatch[1].split('\n');
      const hunkContent = completeDiffMatch[2].split('\n');

      // Just extract all kept and added lines (starting with ' ' or '+')
      // and skip all removed lines (starting with '-')
      const keptContent = hunkContent
        .filter(line => line.startsWith(' ') || line.startsWith('+'))
        .map(line => line.substring(1))
        .join('\n');

      if (keptContent) {
        return keptContent;
      }
    }

    // Simple string replacement if recognizable patterns exist
    const singleLineDiffMatch = diffContent.match(/-([^\n]+)\n\+([^\n]+)/);
    if (singleLineDiffMatch) {
      const oldLine = singleLineDiffMatch[1];
      const newLine = singleLineDiffMatch[2];

      // Try direct string replacement
      const lines = originalContent.split('\n');
      const index = lines.findIndex(line => line.trim() === oldLine.trim());
      if (index !== -1) {
        lines[index] = newLine;
        return lines.join('\n');
      }
    }

    // Last resort: just attempt direct string replacement
    const minusParts = diffContent.match(/^-(.*)$/gm);
    const plusParts = diffContent.match(/^\+(.*)$/gm);

    if (minusParts && plusParts && minusParts.length === plusParts.length) {
      let content = originalContent;

      for (let i = 0; i < minusParts.length; i++) {
        const minusLine = minusParts[i].substring(1);
        const plusLine = plusParts[i].substring(1);

        content = content.replace(minusLine, plusLine);
      }

      return content;
    }

    // Ultimate fallback
    return originalContent;
  } catch (error) {
    console.error("Error parsing diff:", error);
    return originalContent;
  }
}

// Helper function to find best position for context lines in original content
function findBestPosition(originalLines: string[], contextLines: string[]): number {
  if (contextLines.length === 0) return 1;

  let bestPos = 1;
  let bestScore = 0;

  for (let pos = 0; pos <= originalLines.length - contextLines.length; pos++) {
    let score = 0;

    for (let i = 0; i < contextLines.length; i++) {
      // Compare line by line, ignoring whitespace
      const contextNorm = contextLines[i].trim();
      const originalNorm = originalLines[pos + i].trim();

      if (contextNorm === originalNorm) {
        score += 1;
      } else if (contextNorm.replace(/\s+/g, '') === originalNorm.replace(/\s+/g, '')) {
        // Same content but different whitespace
        score += 0.8;
      } else if (originalNorm.includes(contextNorm) || contextNorm.includes(originalNorm)) {
        // Partial match
        score += 0.5;
      }
    }

    // Normalize score based on number of context lines
    const normalizedScore = score / contextLines.length;

    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestPos = pos + 1; // Convert to 1-based indexing
    }
  }

  // Only return position if we have a good match
  return bestScore > 0.6 ? bestPos : 1;
}

// Wrap component in React.memo to prevent unnecessary remounts
// Helper function to modify Monaco editor instance for better error handling
function setupSafeMonacoCleanup() {
  // This runs once when the module is loaded
  if (typeof window !== 'undefined') {
    // Add event listener for beforeunload to clean up Monaco resources properly
    window.addEventListener('beforeunload', () => {
      try {
        // Try to clean up Monaco models on page unload
        if ((window as any).monaco?.editor) {
          const models = (window as any).monaco.editor.getModels();
          models.forEach((model: any) => {
            if (!model.isDisposed()) {
              // Set to null first
              try {
                model.dispose();
              } catch (e) {
                // Ignore errors
              }
            }
          });
        }
      } catch (e) {
        // Ignore any errors during cleanup on page unload
      }
    });
  }
}

// Call setup function at module load time - outside the component
setupSafeMonacoCleanup();

export const CodeEditor = React.memo(function CodeEditor({
  session,
  theme = "dark",
  readOnly = false,
  onCommandK,
}: CodeEditorProps) {
  // Track previous values to prevent loading flicker
  const prevContentRef = useRef<string | undefined>(undefined);

  // Container ref for the single editor
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [, addFileToWorkspace] = useAtom(addFileToWorkspaceAtom);
  
  // Keep single references to the editor and monaco
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  
  // Track if we're in diff mode
  const [inDiffMode, setInDiffMode] = useState(false);
  
  const { handleEditorInit } = useMonacoEditor(selectedFile);

  const [allFilesWithPendingPatches] = useAtom(allFilesWithPendingPatchesAtom);
  const [allFilesBeforeApplyingPendingPatches] = useAtom(allFilesBeforeApplyingPendingPatchesAtom);

  const [acceptDropdownOpen, setAcceptDropdownOpen] = useState(false);
  const [rejectDropdownOpen, setRejectDropdownOpen] = useState(false);

  const acceptButtonRef = useRef<HTMLDivElement>(null);
  const rejectButtonRef = useRef<HTMLDivElement>(null);

  const [currentDiffIndex, setCurrentDiffIndex] = useAtom(currentDiffIndexAtom);
  const [, updateCurrentDiffIndex] = useAtom(updateCurrentDiffIndexAtom);

  const [, updateFileContent] = useAtom(updateFileContentAtom);

  // Define getLanguage function before it's used
  const getLanguage = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'txt':
        return 'plaintext';
      default:
        return 'plaintext';
    }
  };

  // Get content and language details
  const original = selectedFile?.content || '';
  const language = getLanguage(selectedFile?.filePath || '');

  // Extract modified content from diff
  let modifiedContent = "";
  if (selectedFile?.pendingPatch) {
    try {
      modifiedContent = parseDiff(selectedFile.content, selectedFile.pendingPatch);
    } catch (error) {
      console.error("Error parsing diff:", error);
      modifiedContent = selectedFile.pendingPatch;
    }
  }

  // Define a mount handler that sets up our single editor instance
  const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    // Store references
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Store in global window for emergency recovery
    window.__monacoEditor = editor;
    window.__monaco = monaco;
    window.__monacoModels = window.__monacoModels || {};
    
    // Initialize the editor
    handleEditorInit(editor, monaco);

    // Add keyboard shortcuts
    const commandId = 'chartsmith.openCommandPalette';
    editor.addAction({
      id: commandId,
      label: 'Open Command Palette',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: () => {
        if (onCommandK) {
          onCommandK();
        }
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      if (onCommandK) {
        onCommandK();
        return null;
      }
    });
  };

  // Add effect to update models when file or diff mode changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !selectedFile) return;
    
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    
    // Get file info
    const fileKey = selectedFile.id || selectedFile.filePath || 'unknown';
    const isDiffMode = !!selectedFile.pendingPatch;
    
    // Set the diff mode state
    setInDiffMode(isDiffMode);
    
    // Get or create a text model for this file
    let model = window.__monacoModels?.[fileKey];
    if (!model) {
      const uri = monaco.Uri.parse(`file:///${fileKey}`);
      model = monaco.editor.createModel(
        selectedFile.content || '', 
        language, 
        uri
      );
      if (window.__monacoModels) {
        window.__monacoModels[fileKey] = model;
      }
    } else {
      // Update existing model if content changed
      if (model.getValue() !== selectedFile.content) {
        model.setValue(selectedFile.content || '');
      }
    }
    
    // Handle diff mode or regular mode
    if (isDiffMode) {
      // Create a modified model for the diff
      const modifiedKey = `${fileKey}-modified`;
      let modifiedModel = window.__monacoModels?.[modifiedKey];
      
      if (!modifiedModel) {
        const uri = monaco.Uri.parse(`file:///${modifiedKey}`);
        modifiedModel = monaco.editor.createModel(
          modifiedContent, 
          language, 
          uri
        );
        if (window.__monacoModels) {
          window.__monacoModels[modifiedKey] = modifiedModel;
        }
      } else {
        modifiedModel.setValue(modifiedContent);
      }
      
      // Set up diff editor config
      const diffOptions = {
        ...editor.getOptions(),
        readOnly: true,
        renderSideBySide: false,
        originalEditable: false,
        modifiedEditable: false
      };
      
      // Use editor API to create diff view with our models
      monaco.editor.createDiffEditor(
        editorContainerRef.current as HTMLElement, 
        diffOptions
      ).setModel({
        original: model,
        modified: modifiedModel
      });
    } else {
      // Regular editor mode - just update the model
      editor.setModel(model);
      
      // Update editor options
      editor.updateOptions({
        readOnly: readOnly
      });
    }
    
    // Cleanup function
    return () => {
      // Don't dispose models as we're reusing them
    };
  }, [selectedFile?.id, selectedFile?.content, selectedFile?.pendingPatch, readOnly, language, modifiedContent]);

  // Define editorOptions before using them
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 11,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true, // Auto-resize when container size changes
    tabSize: 2,
    readOnly: readOnly,
    glyphMargin: true,
    lineDecorationsWidth: 5,
    renderLineHighlight: "all" as const,
    folding: true,
    wordWrap: 'off' as const,
    wrappingIndent: "indent" as const,
    fixedOverflowWidgets: true,
    overviewRulerBorder: false,
    overviewRulerLanes: 2,
    hideCursorInOverviewRuler: true,
    renderWhitespace: "all" as const,
  };

  // We only create one editor instance now
  const monacoEditor = React.useMemo(() => {
    return (
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        value={selectedFile?.content ?? prevContentRef.current ?? ""}
        onChange={(newValue) => {
          if (selectedFile && newValue !== undefined && !readOnly && !inDiffMode) {
            updateFileContent({
              ...selectedFile,
              content: newValue
            });
          }
        }}
        theme={theme === "light" ? "vs" : "vs-dark"}
        options={editorOptions}
        onMount={handleEditorMount}
      />
    );
  }, []); // Empty dependency array because we handle updates in useEffect

  // Keep previous content in sync with current selection
  useEffect(() => {
    if (selectedFile?.content) {
      prevContentRef.current = selectedFile.content;
    }
  }, [selectedFile?.content]);

  // Update content whenever selectedFile changes
  useEffect(() => {
    // Don't show loading state if we already have an editor reference
    if (selectedFile && editorRef.current) {
      // No loading state to manage
    }
  }, [selectedFile]);

  useEffect(() => {
    updateCurrentDiffIndex(allFilesWithPendingPatches);
  }, [selectedFile, allFilesWithPendingPatches, updateCurrentDiffIndex]);

  // Add effect to track pendingPatch changes
  useEffect(() => {
    console.log(`[DEBUG] pendingPatch changed: ${selectedFile?.pendingPatch ? 'added' : 'removed'} for file ${selectedFile?.filePath}`);
  }, [selectedFile?.pendingPatch]);

  if (!workspace) {
    return null;
  }

  const showDiffHeader = allFilesWithPendingPatches.length > 0;

  // Render the header if needed
  const headerElement = showDiffHeader ? (
    <div className={`flex items-center justify-end gap-2 p-2 border-b min-h-[36px] pr-4 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"} sticky top-0 z-20`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${
            theme === "dark" ? "text-gray-400" : "text-gray-500"
          }`}>
            Showing {currentDiffIndex + 1}/{allFilesWithPendingPatches.length} files with diffs
          </span>
          <div className={`flex rounded overflow-hidden border ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
            <button
              className={`p-1 ${
                theme === "dark"
                  ? "bg-dark-border/40 text-gray-300 hover:bg-dark-border/60"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => {
                if (allFilesWithPendingPatches.length === 0) return;
                const newIndex = currentDiffIndex <= 0
                  ? allFilesWithPendingPatches.length - 1
                  : currentDiffIndex - 1;
                setCurrentDiffIndex(newIndex);
                setSelectedFile(allFilesWithPendingPatches[newIndex]);
              }}
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              className={`p-1 border-l ${
                theme === "dark"
                  ? "bg-dark-border/40 text-gray-300 hover:bg-dark-border/60 border-dark-border"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200"
              }`}
              onClick={() => {
                if (allFilesWithPendingPatches.length === 0) return;
                const newIndex = currentDiffIndex >= allFilesWithPendingPatches.length - 1
                  ? 0
                  : currentDiffIndex + 1;
                setCurrentDiffIndex(newIndex);
                setSelectedFile(allFilesWithPendingPatches[newIndex]);
              }}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const onFileUpdate = (updatedFile: WorkspaceFile) => {
    // Placeholder for future implementation
  };

  const handleAcceptThisFile = async () => {
    if (selectedFile?.pendingPatch) {
      try {
        // Get the modified content from our pre-computed value or parsing function
        let updatedContent = modifiedContent;
        
        // Ensure we have content
        if (!updatedContent) {
          updatedContent = parseDiff(selectedFile.content, selectedFile.pendingPatch);
        }

        if (selectedFile.id.startsWith('file-')) {
          // Create an updated file with pending patch cleared
          const updatedFile = {
            ...selectedFile,
            content: updatedContent,
            pendingPatch: undefined
          };

          // Update editor state
          updateFileContent(updatedFile);

          // Update workspace state
          const updatedWorkspace = {
            ...workspace,
            files: workspace.files.map(f =>
              f.id === updatedFile.id ? updatedFile : f
            ),
            charts: workspace.charts.map(chart => ({
              ...chart,
              files: chart.files.map(f =>
                f.id === updatedFile.id ? updatedFile : f
              )
            }))
          };

          setWorkspace(updatedWorkspace);
        } else {
          try {
            // For permanent IDs, try to use the server action first
            const updatedFile = await acceptPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);

            // Update editor state
            updateFileContent(updatedFile);

            // Update workspace state
            const updatedWorkspace = {
              ...workspace,
              files: workspace.files.map(f =>
                f.id === updatedFile.id ? updatedFile : f
              ),
              charts: workspace.charts.map(chart => ({
                ...chart,
                files: chart.files.map(f =>
                  f.id === updatedFile.id ? updatedFile : f
                )
              }))
            };
            setWorkspace(updatedWorkspace);
          } catch (serverError) {
            console.error("Server-side patch application failed, using client-side fallback:", serverError);

            // If server action fails, fall back to client-side approach
            const updatedFile = {
              ...selectedFile,
              content: updatedContent,
              pendingPatch: undefined
            };

            // Update editor state
            updateFileContent(updatedFile);

            // Update workspace state
            const updatedWorkspace = {
              ...workspace,
              files: workspace.files.map(f =>
                f.id === updatedFile.id ? updatedFile : f
              ),
              charts: workspace.charts.map(chart => ({
                ...chart,
                files: chart.files.map(f =>
                  f.id === updatedFile.id ? updatedFile : f
                )
              }))
            };
            setWorkspace(updatedWorkspace);
          }
        }

        setAcceptDropdownOpen(false);
      } catch (error) {
        console.error("Error accepting patch:", error);

        // Last-ditch effort: just clear the pending patch without applying it
        try {
          const updatedFile = {
            ...selectedFile,
            pendingPatch: undefined
          };

          updateFileContent(updatedFile);

          const updatedWorkspace = {
            ...workspace,
            files: workspace.files.map(f =>
              f.id === updatedFile.id ? updatedFile : f
            ),
            charts: workspace.charts.map(chart => ({
              ...chart,
              files: chart.files.map(f =>
                f.id === updatedFile.id ? updatedFile : f
              )
            }))
          };
          setWorkspace(updatedWorkspace);

        } catch (fallbackError) {
          console.error("Even fallback failed:", fallbackError);
        }

        setAcceptDropdownOpen(false);
      }
    }
  };

  const handleAcceptAllFiles = async () => {
    const updatedFiles = await acceptAllPatchesAction(session, workspace.id, workspace.currentRevisionNumber);

    // Update editor state for currently selected file if it was updated
    if (selectedFile && updatedFiles.some(f => f.id === selectedFile.id)) {
      const updatedFile = updatedFiles.find(f => f.id === selectedFile.id);
      if (updatedFile) {
        updateFileContent(updatedFile);
      }
    }

    // Update workspace state
    const updatedWorkspace = {
      ...workspace,
      files: workspace.files.map(f => {
        const updatedFile = updatedFiles.find(uf => uf.id === f.id);
        return updatedFile || f;
      }),
      charts: workspace.charts.map(chart => ({
        ...chart,
        files: chart.files.map(f => {
          const updatedFile = updatedFiles.find(uf => uf.id === f.id);
          return updatedFile || f;
        })
      }))
    };
    setWorkspace(updatedWorkspace);

    setAcceptDropdownOpen(false);
  };

  const handleRejectThisFile = async () => {
    if (selectedFile?.pendingPatch) {
      try {
        // For temporary IDs, just clear the pendingPatch client-side
        if (selectedFile.id.startsWith('file-')) {

          // Create updated file with pendingPatch cleared
          const updatedFile = {
            ...selectedFile,
            pendingPatch: undefined
          };

          // Update editor state
          updateFileContent(updatedFile);

          // Update workspace state
          const updatedWorkspace = {
            ...workspace,
            files: workspace.files.map(f =>
              f.id === updatedFile.id ? updatedFile : f
            ),
            charts: workspace.charts.map(chart => ({
              ...chart,
              files: chart.files.map(f =>
                f.id === updatedFile.id ? updatedFile : f
              )
            }))
          };

          setWorkspace(updatedWorkspace);
        } else {
          // For permanent IDs, use the server action
          await rejectPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);

          // Create updated file with pendingPatch cleared for UI update
          const updatedFile = {
            ...selectedFile,
            pendingPatch: undefined
          };

          // Update editor state
          updateFileContent(updatedFile);

          // Update workspace state
          const updatedWorkspace = {
            ...workspace,
            files: workspace.files.map(f =>
              f.id === updatedFile.id ? updatedFile : f
            ),
            charts: workspace.charts.map(chart => ({
              ...chart,
              files: chart.files.map(f =>
                f.id === updatedFile.id ? updatedFile : f
              )
            }))
          };

          setWorkspace(updatedWorkspace);
        }
      } catch (error) {
        console.error("Error rejecting patch:", error);

        // Fall back to client-side rejection for any errors
        try {
          // Create updated file with pendingPatch cleared
          const updatedFile = {
            ...selectedFile,
            pendingPatch: undefined
          };

          // Update editor state
          updateFileContent(updatedFile);

          // Update workspace state
          const updatedWorkspace = {
            ...workspace,
            files: workspace.files.map(f =>
              f.id === updatedFile.id ? updatedFile : f
            ),
            charts: workspace.charts.map(chart => ({
              ...chart,
              files: chart.files.map(f =>
                f.id === updatedFile.id ? updatedFile : f
              )
            }))
          };

          setWorkspace(updatedWorkspace);
        } catch (clientError) {
          console.error("Failed to reject patch on client too:", clientError);
        }
      }

      setRejectDropdownOpen(false);
    }
  };

  const handleRejectAllFiles = async () => {
    await rejectAllPatchesAction(session, workspace.id, workspace.currentRevisionNumber);
    setRejectDropdownOpen(false);
  };

  const handlePrevDiff = () => {
    if (allFilesWithPendingPatches.length === 0) return;

    const newIndex = currentDiffIndex <= 0
      ? allFilesWithPendingPatches.length - 1
      : currentDiffIndex - 1;

    setCurrentDiffIndex(newIndex);
    setSelectedFile(allFilesWithPendingPatches[newIndex]);
  };

  const handleNextDiff = () => {
    if (allFilesWithPendingPatches.length === 0) return;

    const newIndex = currentDiffIndex >= allFilesWithPendingPatches.length - 1
      ? 0
      : currentDiffIndex + 1;

    setCurrentDiffIndex(newIndex);
    setSelectedFile(allFilesWithPendingPatches[newIndex]);
  };

  const currentFileNumber = allFilesWithPendingPatches.length > 0 ? currentDiffIndex + 1 : 0;

  const renderDiffHeader = () => (
    <div className={`flex items-center justify-end gap-2 p-2 border-b min-h-[36px] pr-4 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"} sticky top-0 z-20`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${
            theme === "dark" ? "text-gray-400" : "text-gray-500"
          }`}>
            Showing {currentFileNumber}/{allFilesWithPendingPatches.length} files with diffs
          </span>
          <div className={`flex rounded overflow-hidden border ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
            <button
              className={`p-1 ${
                theme === "dark"
                  ? "bg-dark-border/40 text-gray-300 hover:bg-dark-border/60"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={handlePrevDiff}
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              className={`p-1 border-l ${
                theme === "dark"
                  ? "bg-dark-border/40 text-gray-300 hover:bg-dark-border/60 border-dark-border"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200"
              }`}
              onClick={handleNextDiff}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {allFilesWithPendingPatches.length > 0 && selectedFile?.pendingPatch && (
          <div className="flex items-center gap-2">
            <div ref={acceptButtonRef} className="relative">
              <div className="flex">
                <button
                  className={`px-3 py-1 text-xs rounded-l-md flex items-center gap-1 font-mono ${
                    theme === "dark"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                  onClick={handleAcceptThisFile}
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
                <button
                  className={`px-1 py-1 text-xs rounded-r-md flex items-center border-l border-green-700 ${
                    theme === "dark"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                  onClick={() => setAcceptDropdownOpen(!acceptDropdownOpen)}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              {acceptDropdownOpen && (
                <div className={`absolute right-0 mt-1 w-56 rounded-md shadow-lg z-30 ${
                  theme === "dark" ? "bg-dark-surface border border-dark-border" : "bg-white border border-gray-200"
                }`}>
                  <div className="py-1">
                    <button
                      className={`block w-full text-left px-4 py-2 text-xs ${
                        theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={handleAcceptThisFile}
                    >
                      <div className="flex items-center">
                        <span className="font-medium">This file only</span>
                        <span className="ml-2 text-xs opacity-70">({selectedFile?.filePath?.split('/').pop()})</span>
                      </div>
                    </button>
                    <button
                      className={`block w-full text-left px-4 py-2 text-xs ${
                        theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={handleAcceptAllFiles}
                    >
                      <div className="flex items-center">
                        <span className="font-medium">All files</span>
                        <span className="ml-2 text-xs opacity-70">({allFilesWithPendingPatches.length} files)</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div ref={rejectButtonRef} className="relative">
              <div className="flex">
                <button
                  className={`px-3 py-1 text-xs rounded-l-md flex items-center gap-1 font-mono ${
                    theme === "dark"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                  onClick={handleRejectThisFile}
                >
                  <X className="w-3 h-3" />
                  Reject
                </button>
                <button
                  className={`px-1 py-1 text-xs rounded-r-md flex items-center border-l border-red-700 ${
                    theme === "dark"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                  onClick={() => setRejectDropdownOpen(!rejectDropdownOpen)}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              {rejectDropdownOpen && (
                <div className={`absolute right-0 mt-1 w-56 rounded-md shadow-lg z-30 ${
                  theme === "dark" ? "bg-dark-surface border border-dark-border" : "bg-white border border-gray-200"
                }`}>
                  <div className="py-1">
                    <button
                      className={`block w-full text-left px-4 py-2 text-xs ${
                        theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={handleRejectThisFile}
                    >
                      <div className="flex items-center">
                        <span className="font-medium">This file only</span>
                        <span className="ml-2 text-xs opacity-70">({selectedFile?.filePath?.split('/').pop()})</span>
                      </div>
                    </button>
                    <button
                      className={`block w-full text-left px-4 py-2 text-xs ${
                        theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={handleRejectAllFiles}
                    >
                      <div className="flex items-center">
                        <span className="font-medium">All files</span>
                        <span className="ml-2 text-xs opacity-70">({allFilesWithPendingPatches.length} files)</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


      </div>
    </div>
  );

  const handleNewFile = async (filePath: string, content: string) => {
    if (!workspace) return;

    // Create a new WorkspaceFile object
    const newFile = {
      id: `${workspace.id}:${filePath}`, // Format matches backend ID generation
      workspaceId: workspace.id,
      filePath: filePath,
      content: content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pendingPatch: undefined,
      isDeleted: false
    };

    // Add the new file to workspace state
    await addFileToWorkspace(newFile);
  };

  // The final rendered component with a more stable structure - single editor instance
  return (
    <div className="flex-1 h-full flex flex-col">
      {/* Always render header if it exists */}
      {headerElement}

      {/* Fixed container that doesn't change - only one editor */}
      <div ref={editorContainerRef} className="flex-1 h-full">
        {monacoEditor}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // We don't need to re-render for these prop changes since we handle updates in useEffect
  return true;
});
