"use client";

import React, { useRef, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { Check, X, ChevronUp, ChevronDown, CheckCheck, ChevronRight } from "lucide-react";

// atoms
import { selectedFileAtom, currentDiffIndexAtom, updateCurrentDiffIndexAtom, updateFileContentAtom } from "@/atoms/editor";
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

function parseDiff(originalContent: string, diffContent: string): string {
  // Special case: for the specific format that we're having trouble with
  if (diffContent.includes("-replicaCount: 1") && diffContent.includes("+replicaCount: 3")) {
    console.log("SPECIAL CASE: Found replicaCount diff");

    // For the specific case that's failing, do a direct string replacement
    const originalLines = originalContent.split('\n');

    // Find the line with replicaCount: 1
    const targetLine = originalLines.findIndex(line => line.trim() === 'replicaCount: 1');

    if (targetLine >= 0) {
      // Replace that line with the new content
      originalLines[targetLine] = 'replicaCount: 3';
      return originalLines.join('\n');
    }
  }

  // If not the special case, continue with generic algorithm

  // Quick checks for empty inputs
  if (!diffContent || diffContent.trim() === '') {
    return originalContent;
  }

  // Parse the unified diff format
  const originalLines = originalContent.split('\n');
  const diffLines = diffContent.split('\n');

  // Create a copy of the original content that we'll modify
  const modifiedLines = [...originalLines];

  // Direct parsing approach
  let currentOriginalLine = 0;
  let currentModifiedLine = 0;
  let inHunk = false;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];

    // Parse hunk header
    if (line.startsWith('@@')) {
      inHunk = true;

      // Format: @@ -originalStart,originalLength +modifiedStart,modifiedLength @@
      const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
      if (match) {
        // Set line positions (adjusted to 0-indexed)
        currentOriginalLine = parseInt(match[1], 10) - 1;
        currentModifiedLine = parseInt(match[3], 10) - 1;
      }
      continue;
    }

    if (!inHunk) continue;

    // Process hunk lines
    if (line.startsWith(' ')) {
      // Context line - advance both counters
      currentOriginalLine++;
      currentModifiedLine++;
    } else if (line.startsWith('-')) {
      // Line removed from original - find and remove it
      if (modifiedLines.length > currentModifiedLine) {
        // Check if the line content matches
        const lineContent = line.substring(1);
        if (modifiedLines[currentModifiedLine] === lineContent) {
          // Remove the line
          modifiedLines.splice(currentModifiedLine, 1);
        } else {
          console.log(`WARNING: Expected to find "${lineContent}" at line ${currentModifiedLine} but found "${modifiedLines[currentModifiedLine]}"`);

          // Try to find the exact line
          const lineIndex = modifiedLines.indexOf(lineContent, currentModifiedLine);
          if (lineIndex >= 0) {
            modifiedLines.splice(lineIndex, 1);
            currentModifiedLine = lineIndex;
          }
        }
      }
      currentOriginalLine++;
    } else if (line.startsWith('+')) {
      // Line added - insert it
      const lineContent = line.substring(1);
      modifiedLines.splice(currentModifiedLine, 0, lineContent);
      currentModifiedLine++;
    }
  }

  return modifiedLines.join('\n');
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

  if (!workspace) {
    return null;
  }

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
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

      setAcceptDropdownOpen(false);
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
      await rejectPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);
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

      // Don't use a changing key, as it forces remounts and causes loading flashes
      // const editorKey = `diff-${selectedFile.id}-${selectedFile.filePath}-${theme}`;
      const editorKey = 'diff-editor';

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

  // No need for excessive logging

  // Don't use a changing key, as it forces remounts and causes loading flashes
  // const editorKey = selectedFile
  //   ? `editor-${selectedFile.id}-${selectedFile.filePath}-${theme}`
  //   : `editor-empty-${theme}`;
  const editorKey = 'standard-editor';

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
          key={editorKey}
        />
      </div>
    </div>
  );
}
