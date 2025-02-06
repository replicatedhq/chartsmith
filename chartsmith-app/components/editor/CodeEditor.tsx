import React, { useRef, useEffect } from "react";
import type { editor } from "monaco-editor";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type { WorkspaceFile } from "@/lib/types/workspace";
import { useMonacoEditor } from "../../hooks/useMonacoEditor";
import { Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { Session } from "@/lib/types/session";
import { rejectPatchAction } from "@/lib/workspace/actions/reject-patch";

interface CodeEditorProps {
  session: Session;
  file?: WorkspaceFile;
  theme?: "light" | "dark";
  value?: string;
  onChange?: (value: string | undefined) => void;
  onCommandK?: () => void;
}

export function CodeEditor({ session, file, theme = "light", value, onChange, onCommandK }: CodeEditorProps) {
  console.log('CodeEditor render, onCommandK is:', onCommandK);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const { handleEditorInit } = useMonacoEditor(file);

  useEffect(() => {
    if (editorRef.current && value) {
      setTimeout(() => {
        editorRef.current?.revealLine(Number.MAX_SAFE_INTEGER);
      }, 0);
    }
  }, [value]);

  useEffect(() => {
    if (file?.pendingPatch && diffEditorRef.current) {
      const attemptScroll = (attempt = 1, maxAttempts = 5) => {
        setTimeout(() => {
          const editor = diffEditorRef.current;
          if (!editor) return;

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
  }, [file?.pendingPatch]);

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    editorRef.current = editor;
    handleEditorInit(editor, monaco);

    // Register a new command
    const commandId = 'chartsmith.openCommandPalette';
    editor.addAction({
      id: commandId,
      label: 'Open Command Palette',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: () => {
        console.log("Running command palette action in editor");
        console.log("onCommandK value at execution:", onCommandK);
        if (onCommandK) {
          console.log("Calling onCommandK");
          onCommandK();
          console.log("onCommandK called");
        }
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      console.log("Command K triggered in editor");
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

    // Register command for both editors in diff view
    const commandId = 'chartsmith.openCommandPalette';
    [modifiedEditor, originalEditor].forEach(ed => {
      ed.addAction({
        id: commandId,
        label: 'Open Command Palette',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
        run: () => {
          console.log("Running command palette action from diff editor");
          onCommandK?.();
        }
      });
    });

    modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      console.log("Command K triggered in diff editor (modified)");
      if (onCommandK) {
        onCommandK();
        return null;
      }
    });

    originalEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      console.log("Command K triggered in diff editor (original)");
      if (onCommandK) {
        onCommandK();
        return null;
      }
    });
  };

  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 11,
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    readOnly: !onChange,
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
  };

  if (file?.pendingPatch) {
    const lines = file.pendingPatch.split('\n');
    let modified = value || "";
    let currentLine = 0;
    let contentStarted = false;
    const modifiedLines = modified.split('\n');

    for (const line of lines) {
      if (line.startsWith('---') || line.startsWith('+++')) {
        continue;
      }
      if (!contentStarted && !line.startsWith('@')) {
        continue;
      }
      if (line.startsWith('@')) {
        const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
        if (match) {
          currentLine = parseInt(match[3]) - 1;
          contentStarted = true;
        }
        continue;
      }
      if (contentStarted) {
        if (line.startsWith('+')) {
          modifiedLines.splice(currentLine, 0, line.substring(1));
          currentLine++;
        } else if (line.startsWith('-')) {
          modifiedLines.splice(currentLine, 1);
        } else {
          currentLine++;
        }
      }
    }

    return (
      <div className="flex-1 h-full flex flex-col">
        <div className={`flex items-center justify-end gap-2 p-2 border-b min-h-[36px] pr-4 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
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
          <button
            className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 font-mono ${
              theme === "dark"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
            onClick={() => {/* TODO: Handle apply */}}
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
              rejectPatchAction(session, file.filePath);
            }}
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        </div>
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
    <div className="flex-1 h-full">
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
