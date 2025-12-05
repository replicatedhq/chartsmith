"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useAtom } from "jotai";
import { Check, X, ChevronUp, ChevronDown } from "lucide-react";

// atoms
import { selectedFileAtom, currentDiffIndexAtom, updateCurrentDiffIndexAtom, updateFileContentAtom } from "@/atoms/workspace";
import { allFilesBeforeApplyingContentPendingAtom, allFilesWithContentPendingAtom, workspaceAtom, addFileToWorkspaceAtom, plansAtom } from "@/atoms/workspace";

// types
import type { editor } from "monaco-editor";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type { Session } from "@/lib/types/session";

// actions
import { getWorkspaceAction } from "@/lib/workspace/actions/get-workspace";

// hooks
import {
  useMonacoSingleInstance,
  setupSafeMonacoCleanup,
} from "@/hooks/useMonacoSingleInstance";

// actions
import { rejectPatchAction, rejectAllPatchesAction } from "@/lib/workspace/actions/reject-patch";
import { acceptPatchAction, acceptAllPatchesAction } from "@/lib/workspace/actions/accept-patch";

interface CodeEditorProps {
  session: Session;
  theme?: "light" | "dark";
  readOnly?: boolean;
  onCommandK?: () => void;
}

// Initialize Monaco environment
setupSafeMonacoCleanup();

export const CodeEditor = React.memo(function CodeEditor({
  session,
  theme = "dark",
  readOnly = false,
  onCommandK,
}: CodeEditorProps) {
  // Container ref for the single editor
  const editorContainerRef = useRef<HTMLDivElement>(null as unknown as HTMLDivElement);

  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [, addFileToWorkspace] = useAtom(addFileToWorkspaceAtom);
  const [plans] = useAtom(plansAtom);

  // References for Monaco - Use non-null assertion to satisfy TypeScript
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null as unknown as editor.IStandaloneCodeEditor);
  const monacoRef = useRef<typeof import("monaco-editor")>(null as unknown as typeof import("monaco-editor"));

  const [allFilesWithContentPending] = useAtom(allFilesWithContentPendingAtom);

  // Get the most recent plan
  const mostRecentPlan = plans.length > 0
    ? plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;


  const [acceptDropdownOpen, setAcceptDropdownOpen] = useState(false);
  const [rejectDropdownOpen, setRejectDropdownOpen] = useState(false);

  const acceptButtonRef = useRef<HTMLDivElement>(null);
  const rejectButtonRef = useRef<HTMLDivElement>(null);

  const [currentDiffIndex, setCurrentDiffIndex] = useAtom(currentDiffIndexAtom);
  const [, updateCurrentDiffIndex] = useAtom(updateCurrentDiffIndexAtom);

  const [, updateFileContent] = useAtom(updateFileContentAtom);

  // Define editor options
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 11,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
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

  // Handler when content changes
  const handleContentChange = (content: string | undefined) => {
    if (selectedFile && content !== undefined) {
      updateFileContent({
        ...selectedFile,
        content
      });
    }
  };

  // Use our custom hook for monaco single instance
  const {
    original,
    language,
    modifiedContent,
    inDiffMode,
    setInDiffMode
  } = useMonacoSingleInstance(
    selectedFile || null,
    editorRef,
    monacoRef
  );

  // Setup editor init handler
  const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add command palette shortcut
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
  };

  // Update diff index when files change
  useEffect(() => {
    // Just update diff index - don't manually clear editor reference
    // This prevents the TextModel disposed error by letting React handle component lifecycle
    updateCurrentDiffIndex(allFilesWithContentPending);
  }, [selectedFile, allFilesWithContentPending, updateCurrentDiffIndex]);

  // Handle outside clicks for dropdowns
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

  if (!workspace) {
    return null;
  }

  // Always show the diff header when there are pending changes, but the contents will change based on plan status
  const showDiffHeader = allFilesWithContentPending.length > 0;

  const handleAcceptThisFile = async () => {
    if (selectedFile?.contentPending && selectedFile.contentPending.length > 0) {
      try {
        // Get the modified content from our pre-computed value and store it locally
        // This ensures we have the value even if the editor is disposed during state updates
        const updatedContent = modifiedContent;

        // First, immediately close the dropdown to prevent double-clicks
        setAcceptDropdownOpen(false);

        // Don't modify editor reference here - this is what causes the "disposed before reset" error
        // Let React's normal component lifecycle handle the editor disposal
        // We'll update state first, which will trigger a re-render with the new content

        // Now handle the actual update logic
        if (selectedFile.id.startsWith('file-')) {
          // For temporary files, handle update client-side
          const updatedFile = {
            ...selectedFile,
            content: updatedContent,
            contentPending: undefined
          };

          // Update workspace state first, editor state will follow
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

          // Now update editor state, after workspace is updated
          // This order matters to avoid race conditions
          setTimeout(() => {
            updateFileContent(updatedFile);
          }, 0);
        } else {
          try {
            // For permanent IDs, use the server action
            const updatedFile = await acceptPatchAction(session, workspace.id, selectedFile.id, workspace.currentRevisionNumber);

            // Update workspace state first
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

            // Then update editor state with a delay to avoid race conditions
            setTimeout(() => {
              updateFileContent(updatedFile);
            }, 0);

            // Reload the workspace to check for revision status changes
            setTimeout(async () => {
              try {
                if (workspace && workspace.id) {
                  const freshWorkspace = await getWorkspaceAction(session, workspace.id);
                  if (freshWorkspace) {
                    setWorkspace(freshWorkspace);
                  }
                }
              } catch (reloadError) {
                console.error("Error reloading workspace:", reloadError);
              }
            }, 500); // Allow time for database updates
          } catch (serverError) {
            console.error("Server-side patch application failed, using client-side fallback:", serverError);

            // If server action fails, use client-side fallback
            const updatedFile = {
              ...selectedFile,
              content: updatedContent,
              contentPending: undefined
            };

            // Update workspace state first
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

            // Then update editor state with a delay
            setTimeout(() => {
              updateFileContent(updatedFile);
            }, 0);
          }
        }
      } catch (error) {
        console.error("Error accepting patch:", error);

        // Last-ditch effort: just clear the pending patch without applying it
        try {
          const updatedFile = {
            ...selectedFile,
            contentPending: undefined
          };

          // Update workspace state first
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

          // Then update editor state with a delay
          setTimeout(() => {
            updateFileContent(updatedFile);
          }, 0);
        } catch (fallbackError) {
          console.error("Even fallback failed:", fallbackError);
        }

        // Make sure dropdown is closed
        setAcceptDropdownOpen(false);
      }
    }
  };

  const handleAcceptAllFiles = async () => {
    try {
      // First, immediately close the dropdown to prevent double-clicks
      setAcceptDropdownOpen(false);

      // Don't clear editor references here, let React handle cleanup
      // Just update the state which will trigger proper re-renders

      // Now call the server action
      const updatedFiles = await acceptAllPatchesAction(session, workspace.id, workspace.currentRevisionNumber);

      // Update workspace state first
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

      // Update editor state with a slight delay to avoid race conditions
      setTimeout(() => {
        // Update editor state for currently selected file if it was updated
        if (selectedFile && updatedFiles.some(f => f.id === selectedFile.id)) {
          const updatedFile = updatedFiles.find(f => f.id === selectedFile.id);
          if (updatedFile) {
            updateFileContent(updatedFile);
          }
        }
      }, 10);

      // Reload the workspace to check for revision status changes
      setTimeout(async () => {
        try {
          if (workspace && workspace.id) {
            const freshWorkspace = await getWorkspaceAction(session, workspace.id);
            if (freshWorkspace) {
              setWorkspace(freshWorkspace);
            }
          }
        } catch (reloadError) {
          console.error("Error reloading workspace:", reloadError);
        }
      }, 500); // Allow time for database updates
    } catch (error) {
      console.error("Error accepting all patches:", error);
      // Make sure dropdown is closed in case of error
      setAcceptDropdownOpen(false);
    }
  };

  const handleRejectThisFile = async () => {
    if (selectedFile?.contentPending && selectedFile.contentPending.length > 0) {
      try {
        // First, immediately close the dropdown to prevent double-clicks
        setRejectDropdownOpen(false);

        // Don't modify editor reference here - just update state
        // Let React's normal component lifecycle handle the editor disposal

        // Now handle the actual rejection logic
        if (selectedFile.id.startsWith('file-')) {
          // For temporary IDs, just clear the contentPending client-side
          const updatedFile = {
            ...selectedFile,
            contentPending: undefined
          };

          // Update workspace state first
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

          // Then update editor state with a delay
          setTimeout(() => {
            updateFileContent(updatedFile);
          }, 10);
        } else {
          // For permanent IDs, use the server action
          await rejectPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);

          // Create updated file with contentPending cleared for UI update
          const updatedFile = {
            ...selectedFile,
            contentPending: undefined
          };

          // Update workspace state first
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

          // Then update editor state with a delay
          setTimeout(() => {
            updateFileContent(updatedFile);
          }, 10);

          // Reload the workspace to check for revision status changes
          setTimeout(async () => {
            try {
              if (workspace && workspace.id) {
                const freshWorkspace = await getWorkspaceAction(session, workspace.id);
                if (freshWorkspace) {
                  setWorkspace(freshWorkspace);
                }
              }
            } catch (reloadError) {
              console.error("Error reloading workspace:", reloadError);
            }
          }, 500); // Allow time for database updates
        }
      } catch (error) {
        console.error("Error rejecting patch:", error);

        // Fall back to client-side rejection for any errors
        try {
          // Create updated file with contentPending cleared
          const updatedFile = {
            ...selectedFile,
            contentPending: undefined
          };

          // Update workspace state first
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

          // Then update editor state with a delay
          setTimeout(() => {
            updateFileContent(updatedFile);
          }, 10);
        } catch (clientError) {
          console.error("Failed to reject patch on client too:", clientError);
        }
      }
    }
  };

  const handleRejectAllFiles = async () => {
    try {
      // First, immediately close the dropdown to prevent double-clicks
      setRejectDropdownOpen(false);

      // Don't clear editor references manually - let React handle it
      // Just proceed with state updates

      // Now perform the server action
      await rejectAllPatchesAction(session, workspace.id, workspace.currentRevisionNumber);

      // Update workspace with patches cleared - client-side update for responsive UI
      if (workspace) {
        const updatedWorkspace = {
          ...workspace,
          files: workspace.files.map(f => ({
            ...f,
            contentPending: undefined
          })),
          charts: workspace.charts.map(chart => ({
            ...chart,
            files: chart.files.map(f => ({
              ...f,
              contentPending: undefined
            }))
          }))
        };

        // Update workspace state first
        setWorkspace(updatedWorkspace);

        // Then update editor state if needed
        if (selectedFile?.contentPending && selectedFile.contentPending.length > 0) {
          setTimeout(() => {
            updateFileContent({
              ...selectedFile,
              contentPending: undefined
            });
          }, 10);
        }

        // Reload the workspace to check for revision status changes
        setTimeout(async () => {
          try {
            if (workspace && workspace.id) {
              const freshWorkspace = await getWorkspaceAction(session, workspace.id);
              if (freshWorkspace) {
                setWorkspace(freshWorkspace);
              }
            }
          } catch (reloadError) {
            console.error("Error reloading workspace:", reloadError);
          }
        }, 500); // Allow time for database updates
      }
    } catch (error) {
      console.error("Error rejecting all patches:", error);
    }
  };

  const handlePrevDiff = () => {
    if (allFilesWithContentPending.length === 0) return;

    const newIndex = currentDiffIndex <= 0
      ? allFilesWithContentPending.length - 1
      : currentDiffIndex - 1;

    setCurrentDiffIndex(newIndex);
    setSelectedFile(allFilesWithContentPending[newIndex]);
  };

  const handleNextDiff = () => {
    if (allFilesWithContentPending.length === 0) return;

    const newIndex = currentDiffIndex >= allFilesWithContentPending.length - 1
      ? 0
      : currentDiffIndex + 1;

    setCurrentDiffIndex(newIndex);
    setSelectedFile(allFilesWithContentPending[newIndex]);
  };

  const currentFileNumber = allFilesWithContentPending.length > 0 ? currentDiffIndex + 1 : 0;

  const renderDiffHeader = () => (
    <div className={`flex items-center justify-end gap-2 p-2 border-b min-h-[36px] pr-4 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"} sticky top-0 z-20`}>
      <div className="flex items-center gap-4">
        {/* Only show diff navigation when the plan is applied */}
        {mostRecentPlan?.status === "applied" && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}>
              Showing {currentFileNumber}/{allFilesWithContentPending.length} files with diffs
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
        )}

        {allFilesWithContentPending.length > 0 && selectedFile?.contentPending && selectedFile.contentPending.length > 0 && (
          <div className="flex items-center gap-2">
            {mostRecentPlan?.status === "applied" && (
              <>
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
                            <span className="ml-2 text-xs opacity-70">({allFilesWithContentPending.length} files)</span>
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
                            <span className="ml-2 text-xs opacity-70">({allFilesWithContentPending.length} files)</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {(mostRecentPlan && mostRecentPlan.status !== "applied") && (
              <div className="text-xs text-gray-500 italic">
                Waiting for plan to complete before changes can be accepted
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const headerElement = showDiffHeader ? renderDiffHeader() : null;

  // Define mount handlers for both editor types
  const handleRegularEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add command palette shortcut
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
  };

  // Handle diff editor mount differently
  const handleDiffEditorMount = (editor: any, monaco: typeof import("monaco-editor")) => {
    // We need to handle the diff editor mount differently
    editorRef.current = editor.getModifiedEditor(); // Store modified editor for consistency
    monacoRef.current = monaco;

    // Add command palette shortcut to the modified editor too
    const commandId = 'chartsmith.openCommandPalette.diffEditor';
    editor.getModifiedEditor().addAction({
      id: commandId,
      label: 'Open Command Palette',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: () => {
        if (onCommandK) {
          onCommandK();
        }
      }
    });
  };

  // Create a stable key for editor rendering
  // Only change the key when the file or mode actually changes - NOT on every render
  const editorKey = selectedFile?.id || 'none';
  const hasContentPending = !!selectedFile?.contentPending && selectedFile.contentPending.length > 0;

  // Stable key: only changes when file changes or diff/normal mode changes
  // DO NOT use Date.now() here - it causes constant remounts and Monaco disposal errors
  const editorStateKey = `${editorKey}-${hasContentPending ? 'diff' : 'normal'}`;

  // Let's try a more conventional approach but with optimizations
  return (
    <div className="flex-1 h-full flex flex-col">
      {/* Always render header if it exists */}
      {headerElement}

      <div className="flex-1 h-full">
        {/* Using a stable key pattern for the outer container */}
        <div key={editorStateKey} className="h-full">
          {selectedFile?.contentPending && selectedFile.contentPending.length > 0 ? (
            // Import DiffEditor dynamically for contentPending
            <DiffEditor
              height="100%"
              language={language}
              original={original}
              modified={modifiedContent}
              loading={null} // Disable the loading message
              theme={theme === "light" ? "vs" : "vs-dark"}
              options={{
                ...editorOptions,
                renderSideBySide: false,
                originalEditable: false,
                diffCodeLens: false,
                readOnly: true
              }}
              onMount={handleDiffEditorMount}
            />
          ) : selectedFile?.contentPending ? (
            // DiffEditor for contentPending
            <DiffEditor
              height="100%"
              language={language}
              original={selectedFile.content}
              modified={selectedFile.contentPending}
              loading={null} // Disable the loading message
              theme={theme === "light" ? "vs" : "vs-dark"}
              options={{
                ...editorOptions,
                renderSideBySide: false,
                originalEditable: false,
                diffCodeLens: false,
                readOnly: true
              }}
              onMount={handleDiffEditorMount}
            />
          ) : (
            // Regular editor for normal mode
            <Editor
              height="100%"
              defaultLanguage={language}
              language={language}
              value={selectedFile?.content || ""}
              loading={null} // Disable the loading message
              onChange={handleContentChange}
              theme={theme === "light" ? "vs" : "vs-dark"}
              options={editorOptions}
              onMount={handleEditorMount}
            />
          )}
        </div>
      </div>
    </div>
  );
});

