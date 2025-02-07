import React, { useRef, useEffect, useState } from "react";
import type { editor } from "monaco-editor";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type { WorkspaceFile } from "@/lib/types/workspace";
import { useMonacoEditor } from "../../hooks/useMonacoEditor";
import { Check, X, ChevronUp, ChevronDown, CheckCheck, ChevronDown as CaretDown } from "lucide-react";
import { Session } from "@/lib/types/session";
import { rejectPatchAction } from "@/lib/workspace/actions/reject-patch";
import { acceptPatchAction } from "@/lib/workspace/actions/accept-patch";

interface CodeEditorProps {
  session: Session;
  file?: WorkspaceFile;
  revision: number;
  theme?: "light" | "dark";
  value?: string;
  onChange?: (value: string | undefined) => void;
  onCommandK?: () => void;
  onFileUpdate?: (file: WorkspaceFile) => void;
  files?: WorkspaceFile[];
}

export function CodeEditor({ session, file, revision, theme = "light", value, onChange, onCommandK, onFileUpdate, files = [] }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { handleEditorInit } = useMonacoEditor(file);
  const [isAcceptDropdownOpen, setIsAcceptDropdownOpen] = useState(false);

  useEffect(() => {
    console.log('CodeEditor file update:', {
      filePath: file?.filePath,
      hasContent: !!file?.content,
      contentLength: file?.content?.length,
      hasPendingPatch: !!file?.pendingPatch,
      patchLength: file?.pendingPatch?.length,
      value: value?.length
    });
  }, [file, value]);

  useEffect(() => {
    if (file?.pendingPatch && diffEditorRef.current) {
      console.log('Setting up diff editor:', {
        filePath: file.filePath,
        originalContent: value,
        originalLength: value?.length,
        patchLength: file.pendingPatch.length
      });

      const attemptScroll = (attempt = 1, maxAttempts = 5) => {
        setTimeout(() => {
          const editor = diffEditorRef.current;
          if (!editor) {
            console.log('No diff editor ref on attempt', attempt);
            return;
          }

          const modifiedEditor = editor.getModifiedEditor();
          const modifiedModel = modifiedEditor.getModel();

          if (!modifiedModel) {
            console.log('No modified model on attempt', attempt);
            if (attempt < maxAttempts) {
              attemptScroll(attempt + 1);
            }
            return;
          }

          const changes = editor.getLineChanges();
          console.log('Diff editor changes:', {
            hasChanges: !!changes,
            changeCount: changes?.length,
            firstChange: changes?.[0]
          });

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
  }, [file?.pendingPatch, value]);

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
    console.log('Diff editor mounted');
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
    wordWrap: 'on' as const,
    wrappingIndent: "indent" as const,
    fixedOverflowWidgets: true,
    overviewRulerBorder: false,
    overviewRulerLanes: 2,
    hideCursorInOverviewRuler: true,
  };

  const hasPendingPatches = files.some(f => f.pendingPatch);
  const showDiffHeader = hasPendingPatches || file?.pendingPatch;

  const renderDiffHeader = () => (
    <div className={`flex items-center justify-end gap-2 p-2 border-b min-h-[36px] pr-4 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      {file?.pendingPatch && (
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 font-mono ${
              theme === "dark"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
            onClick={async () => {
              const filesWithPatches = files.filter(f => f.pendingPatch);
              for (const patchFile of filesWithPatches) {
                const updatedFile = await acceptPatchAction(session, patchFile.id, revision);
                onFileUpdate?.(updatedFile);
              }
            }}
          >
            <CheckCheck className="w-3 h-3" />
            Accept All
          </button>
          <button
            className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 font-mono ${
              theme === "dark"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
            onClick={async () => {
              const updatedFile = await acceptPatchAction(session, file.id, revision);
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
              rejectPatchAction(session, file.id, revision);
            }}
          >
            <X className="w-3 h-3" />
            Reject
          </button>
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

  if (file?.pendingPatch) {
    console.log('Rendering diff view:', {
      filePath: file.filePath,
      patchLength: file.pendingPatch.length,
      originalContent: value,
      originalLength: value?.length,
      patchFirstLine: file.pendingPatch.split('\n')[0],
      patchLineCount: file.pendingPatch.split('\n').length,
      isPatchValidFormat: file.pendingPatch.includes('@@ '),
      rawPatch: file.pendingPatch
    });

    const lines = file.pendingPatch.split('\n');
    const modified = value || "";
    let currentLine = 0;
    let contentStarted = false;
    const modifiedLines = modified.split('\n');

    for (const line of lines) {
      if (line.startsWith('---') || line.startsWith('+++')) {
        console.log('Processing patch header:', { line });
        continue;
      }
      if (!contentStarted && !line.startsWith('@')) {
        continue;
      }
      if (line.startsWith('@')) {
        const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
        console.log('Processing hunk header:', { 
          line,
          hasMatch: !!match,
          matchGroups: match ? match.slice(1) : null,
          currentLine,
          modifiedLinesLength: modifiedLines.length
        });
        if (match) {
          currentLine = parseInt(match[3]) - 1;
          contentStarted = true;
        }
        continue;
      }
      if (contentStarted) {
        if (line.startsWith('+')) {
          console.log('Adding line:', { 
            lineNumber: currentLine,
            content: line.substring(1),
            modifiedLinesLength: modifiedLines.length
          });
          modifiedLines.splice(currentLine, 0, line.substring(1));
          currentLine++;
        } else if (line.startsWith('-')) {
          console.log('Removing line:', { 
            lineNumber: currentLine,
            content: line.substring(1),
            modifiedLinesLength: modifiedLines.length
          });
          if (currentLine < modifiedLines.length) {
            modifiedLines.splice(currentLine, 1);
          }
        } else if (line.trim() !== '') {
          console.log('Context line:', {
            lineNumber: currentLine,
            content: line,
            modifiedLinesLength: modifiedLines.length
          });
          if (currentLine >= modifiedLines.length) {
            modifiedLines.push(line);
          } else {
            modifiedLines[currentLine] = line;
          }
          currentLine++;
        }
      }
    }

    console.log('Final modified content:', {
      originalLineCount: value?.split('\n').length || 0,
      modifiedLineCount: modifiedLines.length,
      firstLine: modifiedLines[0],
      lastLine: modifiedLines[modifiedLines.length - 1],
      allLines: modifiedLines
    });

    return (
      <div className="flex-1 h-full flex flex-col">
        {renderDiffHeader()}
        <div className="flex-1">
          <DiffEditor
            height="100%"
            language="yaml"
            original={value || ""}
            modified={modifiedLines.join('\n')}
            theme={theme === "light" ? "vs" : "vs-dark"}
            onMount={handleDiffEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 11,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: true,
              renderSideBySide: false,
              glyphMargin: true,
              lineDecorationsWidth: 5,
              renderLineHighlight: "all",
              folding: true,
              wordWrap: "on",
              wrappingIndent: "indent",
              fixedOverflowWidgets: true,
              overviewRulerBorder: false,
              overviewRulerLanes: 2,
              hideCursorInOverviewRuler: true,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col">
      {showDiffHeader && renderDiffHeader()}
      <Editor
        height="100%"
        defaultLanguage="yaml"
        language="yaml"
        value={value ?? ""}
        onChange={onChange}
        theme={theme === "light" ? "vs" : "vs-dark"}
        options={editorOptions}
        onMount={handleEditorMount}
        key={`${file?.filePath}-${theme}`}
      />
    </div>
  );
}
