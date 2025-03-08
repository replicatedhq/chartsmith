"use client";

import React, { useRef, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { Check, X, ChevronUp, ChevronDown, CheckCheck, ChevronRight } from "lucide-react";

// atoms
import { selectedFileAtom, currentDiffIndexAtom, updateCurrentDiffIndexAtom, updateFileContentAtom } from "@/atoms/workspace";
import { allFilesBeforeApplyingPendingPatchesAtom, allFilesWithPendingPatchesAtom, workspaceAtom, addFileToWorkspaceAtom } from "@/atoms/workspace";

// types
import type { editor } from "monaco-editor";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type { WorkspaceFile } from "@/lib/types/workspace";

// hooks
import { useMonacoEditor } from "@/hooks/useMonacoEditor";

// actions
import { rejectPatchAction, rejectAllPatchesAction } from "@/lib/workspace/actions/reject-patch";
import { acceptPatchAction, acceptAllPatchesAction } from "@/lib/workspace/actions/accept-patch";

// types
import type { Session } from "@/lib/types/session";

interface CodeEditorProps {
  session: Session;
  theme?: "light" | "dark";
  value?: string;
  onChange?: (value: string | undefined) => void;
  onCommandK?: () => void;
}

// Ultra simple and reliable diff parser that extracts only the final content
function parseDiff(originalContent: string, diffContent: string): string {
  console.log("Using ultra simple diff parser");
  
  // For empty diffs, return original content
  if (!diffContent || diffContent.trim() === '') {
    return originalContent;
  }
  
  // For new files (empty original content), extract only the added lines
  if (originalContent === '' || diffContent.includes('@@ -0,0 +1,')) {
    console.log("Handling new file patch");
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
    
    console.log(`Found direct replacement: ${oldKey}: ${oldValue} -> ${newKey}: ${newValue}`);
    
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
    const completeDiffMatch = diffContent.match(/\n--- .*?\n\+\+\+ .*?\n((?:@@ .*? @@.*?\n)+)((?: .*\n|\+.*\n|-.*\n)*)/s);
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
        console.log("Used direct content extraction from diff");
        return keptContent;
      }
    }
    
    // Simple string replacement if recognizable patterns exist
    const singleLineDiffMatch = diffContent.match(/-([^\n]+)\n\+([^\n]+)/);
    if (singleLineDiffMatch) {
      const oldLine = singleLineDiffMatch[1];
      const newLine = singleLineDiffMatch[2];
      console.log(`Simple line replacement: "${oldLine}" -> "${newLine}"`);
      
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
      console.log("Attempting direct replacement of matching -/+ lines");
      let content = originalContent;
      
      for (let i = 0; i < minusParts.length; i++) {
        const minusLine = minusParts[i].substring(1);
        const plusLine = plusParts[i].substring(1);
        
        console.log(`Replacing "${minusLine}" with "${plusLine}"`);
        content = content.replace(minusLine, plusLine);
      }
      
      return content;
    }
    
    // Ultimate fallback: extract the "Modified" content from diffEditor
    // For this to work, the caller must already have access to the parsed modified version
    console.log("PATCH PARSING FAILED - returning original content");
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

export function CodeEditor({
  session,
  theme = "dark",
  value,
  onChange,
  onCommandK,
}: CodeEditorProps) {
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [, addFileToWorkspace] = useAtom(addFileToWorkspaceAtom);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
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
  
  // Global cleanup for all editor instances when component unmounts
  useEffect(() => {
    return () => {
      // Make sure to clean up any Monaco models that might be lingering
      try {
        if (typeof window !== 'undefined' && window.monaco) {
          const monaco = window.monaco;
          
          // First dispose any editor instances
          if (editorRef.current) {
            editorRef.current.dispose();
            editorRef.current = null;
          }
          
          if (diffEditorRef.current) {
            diffEditorRef.current.dispose();
            diffEditorRef.current = null;
          }
          
          // Then dispose any remaining models
          setTimeout(() => {
            try {
              monaco.editor.getModels().forEach(model => {
                if (!model.isDisposed()) {
                  model.dispose();
                }
              });
            } catch (err) {
              console.log("Error disposing models on unmount:", err);
            }
          }, 50);
        }
      } catch (err) {
        console.log("Error during global editor cleanup:", err);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedFile && onChange) {
      onChange(selectedFile.content);
    }
  }, [selectedFile, onChange]);

  useEffect(() => {
    updateCurrentDiffIndex(allFilesWithPendingPatches);
  }, [selectedFile, allFilesWithPendingPatches, updateCurrentDiffIndex]);

  useEffect(() => {
    if (selectedFile?.pendingPatch && diffEditorRef.current) {
      const attemptScroll = (attempt = 1, maxAttempts = 5) => {
        setTimeout(() => {
          const editor = diffEditorRef.current;
          if (!editor) {
            return;
          }

          const modifiedEditor = editor.getModifiedEditor();
          const modifiedModel = modifiedEditor.getModel();

          if (!modifiedModel) {
            if (attempt < maxAttempts) {
              attemptScroll(attempt + 1);
            }
            return;
          }

          const changes = editor.getLineChanges();

          if (changes && changes.length > 0) {
            const firstChange = changes[0];
            modifiedEditor.revealLineInCenter(firstChange.modifiedStartLineNumber);
            modifiedEditor.setPosition({
              lineNumber: firstChange.modifiedStartLineNumber,
              column: 1
            });
          } else if (attempt < maxAttempts) {
            attemptScroll(attempt + 1);
          }
        }, 100 * attempt);
      };

      attemptScroll();
    }
  }, [selectedFile?.pendingPatch, selectedFile?.filePath, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (acceptButtonRef.current && !acceptButtonRef.current.contains(event.target as Node)) {
        setAcceptDropdownOpen(false);
      }
      if (rejectButtonRef.current && !rejectButtonRef.current.contains(event.target as Node)) {
        setRejectDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Add cleanup effect for editors when component unmounts
  useEffect(() => {
    return () => {
      // Clean up editors on unmount
      if (editorRef.current) {
        try {
          editorRef.current.dispose();
        } catch (err) {
          console.log("Error disposing editor on unmount:", err);
        }
        editorRef.current = null;
      }
      
      if (diffEditorRef.current) {
        try {
          diffEditorRef.current.dispose();
        } catch (err) {
          console.log("Error disposing diff editor on unmount:", err);
        }
        diffEditorRef.current = null;
      }
    };
  }, []);

  if (!workspace) {
    return null;
  }

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    // Clean up previous editor if it exists
    if (editorRef.current) {
      try {
        const previousEditor = editorRef.current;
        editorRef.current = null;
        setTimeout(() => {
          try {
            previousEditor.dispose();
          } catch (err) {
            console.log("Error disposing previous editor:", err);
          }
        }, 0);
      } catch (err) {
        console.log("Error during cleanup:", err);
      }
    }
    
    editorRef.current = editor;
    handleEditorInit(editor, monaco);

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

  const handleDiffEditorMount = (editor: editor.IStandaloneDiffEditor, monaco: typeof import("monaco-editor")) => {
    // Clean up previous editor if it exists
    if (diffEditorRef.current) {
      try {
        // Be extra cautious with cleanup
        const previousEditor = diffEditorRef.current;
        diffEditorRef.current = null;
        setTimeout(() => {
          try {
            previousEditor.dispose();
          } catch (err) {
            console.log("Error disposing previous diff editor:", err);
          }
        }, 0);
      } catch (err) {
        console.log("Error during cleanup:", err);
      }
    }
    
    diffEditorRef.current = editor;

    const modifiedEditor = editor.getModifiedEditor();
    const originalEditor = editor.getOriginalEditor();

    const commandId = 'chartsmith.openCommandPalette';
    [modifiedEditor, originalEditor].forEach(ed => {
      ed.addAction({
        id: commandId,
        label: 'Open Command Palette',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
        run: () => onCommandK?.()
      });
    });

    modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      if (onCommandK) {
        onCommandK();
        return null;
      }
    });

    originalEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      if (onCommandK) {
        onCommandK();
        return null;
      }
    });
  };

  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 11,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    readOnly: !onChange,
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

  const showDiffHeader = allFilesWithPendingPatches.length > 0;

  const onFileUpdate = (updatedFile: WorkspaceFile) => {
    console.log("onFileUpdate", updatedFile);
  };

  const handleAcceptThisFile = async () => {
    if (selectedFile?.pendingPatch) {
      console.log("Accepting patch for file:", {
        fileId: selectedFile.id,
        revision: workspace.currentRevisionNumber,
        filePath: selectedFile.filePath,
        hasPendingPatch: !!selectedFile.pendingPatch
      });
      
      try {
        // Get the current modified content directly from the diff editor
        // This is the most reliable way to get the properly rendered content
        let updatedContent = "";
        
        try {
          // Get content from the diffEditor if it exists
          if (diffEditorRef.current) {
            const modifiedEditor = diffEditorRef.current.getModifiedEditor();
            const modifiedModel = modifiedEditor.getModel();
            if (modifiedModel) {
              // Get the updated content directly from the editor
              updatedContent = modifiedModel.getValue();
              console.log("Got updated content directly from Monaco diff editor");
            }
          }
        } catch (editorError) {
          console.error("Error getting content from editor:", editorError);
        }
        
        // If we couldn't get it from the editor, use our parsing function
        if (!updatedContent) {
          updatedContent = parseDiff(selectedFile.content, selectedFile.pendingPatch);
          console.log("Parsed updated content using parseDiff function");
        }
        
        if (selectedFile.id.startsWith('file-')) {
          console.log("Handling local patch for temporary file ID");
          
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
          console.log("Locally applied patch for temporary file ID");
        } else {
          try {
            // For permanent IDs, try to use the server action first
            const updatedFile = await acceptPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);
            console.log("Patch accepted successfully via server");
            
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
          
          console.log("Applied fallback - just cleared the pending patch");
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
          console.log("Handling local reject for temporary file ID");
          
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
          console.log("Locally rejected patch for temporary file ID");
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
          console.log("Falling back to client-side patch rejection");
          
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
          console.log("Successfully rejected patch client-side as fallback");
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

  if (selectedFile?.pendingPatch) {
    try {
      // Add error handling around the diff parsing
      const modified = parseDiff(selectedFile.content, selectedFile.pendingPatch);

      // For new files where the content is completely empty but we have a patch,
      // we can check if it's a new file pattern and handle it specially
      const isNewFilePatch = selectedFile.pendingPatch.includes('@@ -0,0 +1,');
      const original = selectedFile.content;

      // Use a dynamic key to ensure the component re-mounts when the file changes
      // This prevents monaco editor state issues with disposal
      const editorKey = `diff-${selectedFile.id}-${Date.now()}`;

      // Effect to safely dispose of the editor on unmount
      useEffect(() => {
        return () => {
          if (diffEditorRef.current) {
            try {
              // Wrap in setTimeout to avoid race conditions
              setTimeout(() => {
                if (diffEditorRef.current) {
                  diffEditorRef.current.dispose();
                  diffEditorRef.current = null;
                }
              }, 0);
            } catch (err) {
              console.log("Error disposing diff editor:", err);
            }
          }
        };
      }, [selectedFile?.id]);

      return (
        <div className="flex-1 h-full flex flex-col">
          {showDiffHeader && renderDiffHeader()}
          <div className="flex-1">
            <DiffEditor
              key={editorKey}
              height="100%"
              language={getLanguage(selectedFile.filePath)}
              original={original}
              modified={modified}
              theme={theme === "light" ? "vs" : "vs-dark"}
              onMount={handleDiffEditorMount}
              beforeMount={(monaco) => {
                // Clean up previous models on mount to avoid memory leaks
                try {
                  monaco.editor.getModels().forEach(model => {
                    // Only dispose models that are not being used
                    if (!model.isDisposed()) {
                      model.dispose();
                    }
                  });
                } catch (err) {
                  console.log("Error disposing models:", err);
                }
              }}
              options={{
                ...editorOptions,
                renderSideBySide: false,
                diffWordWrap: 'off',
                originalEditable: false,
                renderOverviewRuler: false,
                ignoreTrimWhitespace: false,
                renderWhitespace: 'none',
                renderLineHighlight: 'none',
                quickSuggestions: false,
                folding: false,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
              }}
            />
          </div>
        </div>
      );
    } catch (error) {
      console.error("Error parsing diff:", error);

      // Fallback to showing raw content if diff parsing fails
      return (
        <div className="flex-1 h-full flex flex-col">
          {showDiffHeader && renderDiffHeader()}
          <div className="flex-1 h-full">
            <Editor
              height="100%"
              defaultLanguage={getLanguage(selectedFile.filePath)}
              language={getLanguage(selectedFile.filePath)}
              value={selectedFile.pendingPatch}
              theme={theme === "light" ? "vs" : "vs-dark"}
              options={{
                ...editorOptions,
                readOnly: true,
              }}
              onMount={handleEditorMount}
              key="fallback-editor"
            />
          </div>
        </div>
      );
    }
  }

  // Use a dynamic key to ensure proper re-mounting
  const editorKey = `editor-${selectedFile?.id || 'empty'}-${Date.now()}`;
  
  // Effect to safely dispose of the standard editor on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        try {
          // Wrap in setTimeout to avoid race conditions
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.dispose();
              editorRef.current = null;
            }
          }, 0);
        } catch (err) {
          console.log("Error disposing standard editor:", err);
        }
      }
    };
  }, [selectedFile?.id]);

  return (
    <div className="flex-1 h-full flex flex-col">
      {showDiffHeader && renderDiffHeader()}
      <div className="flex-1 h-full">
        <Editor
          height="100%"
          defaultLanguage={getLanguage(selectedFile?.filePath || '')}
          language={getLanguage(selectedFile?.filePath || '')}
          value={selectedFile?.content ?? value ?? ""}
          onChange={onChange}
          theme={theme === "light" ? "vs" : "vs-dark"}
          options={{
            ...editorOptions,
            readOnly: !onChange,
          }}
          onMount={handleEditorMount}
          beforeMount={(monaco) => {
            // Clean up previous models to avoid memory leaks
            try {
              monaco.editor.getModels().forEach(model => {
                if (!model.isDisposed()) {
                  model.dispose();
                }
              });
            } catch (err) {
              console.log("Error disposing models:", err);
            }
          }}
          key={editorKey}
        />
      </div>
    </div>
  );
}
