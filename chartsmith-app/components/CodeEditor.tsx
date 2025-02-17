"use client";

import React, { useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { Check, X, ChevronUp, ChevronDown, CheckCheck } from "lucide-react";

// atoms
import { selectedFileAtom } from "@/atoms/editor";
import { filesWithPendingPatchesAtom, workspaceAtom } from "@/atoms/workspace";

// types
import type { editor } from "monaco-editor";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type { WorkspaceFile } from "@/lib/types/workspace";

// hooks
import { useMonacoEditor } from "@/hooks/useMonacoEditor";

// actions
import { rejectPatchAction } from "@/lib/workspace/actions/reject-patch";
import { acceptPatchAction } from "@/lib/workspace/actions/accept-patch";

// types
import type { Session } from "@/lib/types/session";

interface CodeEditorProps {
  session: Session;
  theme?: "light" | "dark";
  value?: string;
  onChange?: (value: string | undefined) => void;
  onCommandK?: () => void;
}

export function CodeEditor({
  session,
  theme = "dark",
  value,
  onChange,
  onCommandK,
}: CodeEditorProps) {
  const [selectedFile] = useAtom(selectedFileAtom);
  const [workspace] = useAtom(workspaceAtom);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const { handleEditorInit } = useMonacoEditor(selectedFile);
  const [filesWithPendingPatches] = useAtom(filesWithPendingPatchesAtom);

  useEffect(() => {
    if (selectedFile && onChange) {
      onChange(selectedFile.content);
    }
  }, [selectedFile, onChange]);

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

  const showDiffHeader = filesWithPendingPatches.length > 0;

  const onFileUpdate = (updatedFile: WorkspaceFile) => {
    console.log("onFileUpdate", updatedFile);
  };

  const renderDiffHeader = () => (
    <div className={`flex items-center justify-end gap-2 p-2 border-b min-h-[36px] pr-4 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      {filesWithPendingPatches.length > 0 && (
        <div className="flex items-center gap-2">
          {filesWithPendingPatches.length > 0 && (
            <button
              className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 font-mono ${
                theme === "dark"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
              onClick={() => {
                const filesWithPatches = filesWithPendingPatches.filter(f => f.pendingPatch);
                filesWithPatches.forEach(async (patchFile) => {
                  const updatedFile = await acceptPatchAction(session, patchFile.id, workspace.currentRevisionNumber);
                  onFileUpdate?.(updatedFile);
                });
              }}
            >
              <CheckCheck className="w-3 h-3" />
              Accept All
            </button>
          )}
          {selectedFile?.pendingPatch && (
            <>
              <button
              className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 font-mono ${
                theme === "dark"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
              onClick={async () => {
                const updatedFile = await acceptPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);
                onChange?.(updatedFile.content);
                onFileUpdate?.(updatedFile);
              }}
            >
              <Check className="w-3 h-3" />
              Accept
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 font-mono ${
                theme === "dark"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
              onClick={() => {
                rejectPatchAction(session, selectedFile.id, workspace.currentRevisionNumber);
              }}
            >
              <X className="w-3 h-3" />
              Reject
            </button>
          </>
        )}
      </div>
    )}
    <div className="ml-8 flex items-center gap-2">
      <span className={`text-xs font-mono ${
        theme === "dark" ? "text-gray-400" : "text-gray-500"
      }`}>
        4/5 diffs
      </span>
      <div className={`flex rounded overflow-hidden border ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        <button
          className={`p-1 ${
            theme === "dark"
              ? "bg-dark-border/40 text-gray-300 hover:bg-dark-border/60"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          onClick={() => {/* TODO: Handle up */}}
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          className={`p-1 border-l ${
            theme === "dark"
              ? "bg-dark-border/40 text-gray-300 hover:bg-dark-border/60 border-dark-border"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200"
          }`}
          onClick={() => {/* TODO: Handle down */}}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
);

  return (
    <div className="flex-1 h-full flex flex-col">
      {showDiffHeader && renderDiffHeader()}
      {selectedFile?.pendingPatch ? (() => {
        const lines = selectedFile.pendingPatch.split('\n');
        const modified = value || "";
        const modifiedLines = modified.split('\n');

        let currentLine = 0;
        let contentStarted = false;
        let currentHunk = null;

        for (const line of lines) {
          // Skip metadata lines
          if (line.startsWith('---') || line.startsWith('+++')) {
            continue;
          }

          // Handle hunk headers
          if (line.startsWith('@@ ')) {
            const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
            if (match) {
              currentHunk = {
                startLine: parseInt(match[3]) - 1,
                linesCount: match[4] ? parseInt(match[4]) : 1
              };
              currentLine = currentHunk.startLine;
              contentStarted = true;
            }
            continue;
          }

          // Only process content if we're in a valid hunk
          if (contentStarted && currentHunk) {
            if (line.startsWith('+')) {
              modifiedLines.splice(currentLine, 0, line.substring(1));
              currentLine++;
            } else if (line.startsWith('-')) {
              if (currentLine < modifiedLines.length) {
                modifiedLines.splice(currentLine, 1);
              }
            } else {
              // Context lines - remove leading space if it exists
              const contextLine = line.startsWith(' ') ? line.substring(1) : line;
              if (currentLine >= modifiedLines.length) {
                modifiedLines.push(contextLine);
              } else {
                modifiedLines[currentLine] = contextLine;
              }
              currentLine++;
            }
          }
        }

        return (
          <div className="flex-1">
            <DiffEditor
              height="100%"
              language="yaml"
              original={value || ""}
              modified={modifiedLines.join('\n')}
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
        );
      })() : (
        <div className="flex-1 h-full">
          <Editor
            height="100%"
            defaultLanguage="yaml"
            language="yaml"
            value={selectedFile?.content ?? value ?? ""}
            onChange={onChange}
            theme={theme === "light" ? "vs" : "vs-dark"}
            options={{
              ...editorOptions,
              readOnly: !onChange,
            }}
            onMount={handleEditorMount}
            key={`${selectedFile?.id}-${selectedFile?.filePath}-${theme}`}
          />
        </div>
      )}
    </div>
  );
}
