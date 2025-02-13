import React from "react";
import { FileBrowser } from "../FileBrowser";
import { RenderedFileBrowser } from "../RenderedFileBrowser";
import { CodeEditor } from "../CodeEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { EditorView } from "../../../hooks/useEditorView";
import { WorkspaceFile, Chart, RenderedFile, RenderUpdate } from "@/lib/types/workspace";
import { Session } from "@/lib/types/session";
import type { editor } from "monaco-editor";
import { Button } from "@/components/ui/Button";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";

interface WorkspaceContainerProps {
  session: Session;
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  files: WorkspaceFile[];
  charts: Chart[];
  revision: number;
  renderedFiles: RenderedFile[];
  selectedFile?: WorkspaceFile;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileDelete: (path: string) => void;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  isFileTreeVisible: boolean;
  onCommandK?: () => void;
  onFileUpdate?: (file: WorkspaceFile) => void;
  renderUpdates?: RenderUpdate[];
  editorRef?: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  workspaceId: string;
}

export function WorkspaceContainer({
  session,
  view,
  onViewChange,
  files,
  charts,
  renderedFiles,
  revision,
  selectedFile,
  onFileSelect,
  onFileDelete,
  editorContent,
  onEditorChange,
  isFileTreeVisible,
  onCommandK,
  onFileUpdate,
  renderUpdates = [],
  editorRef,
  workspaceId
}: WorkspaceContainerProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] min-h-0 max-w-[calc(100vw-545px)] overflow-hidden">
      <div className="flex-1 flex min-h-0">
        <div className="w-[260px] flex-shrink-0">
          {isFileTreeVisible && (
            <FileBrowser
              nodes={files}
              onFileSelect={onFileSelect}
              onFileDelete={onFileDelete}
              selectedFile={selectedFile}
              charts={charts}
            />
          )}
        </div>
        <div className={`w-px ${resolvedTheme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center px-2 border-b border-dark-border/40 bg-dark-surface/40">
            <div
              onClick={() => onViewChange("source")}
              className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative group ${
                view === "source"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {view === "source" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              Source
            </div>
            <div
              onClick={() => onViewChange("rendered")}
              className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative group ${
                view === "rendered"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {view === "rendered" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              Rendered
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {view === "rendered" && selectedFile && !renderedFiles.find(rf => rf.filePath === selectedFile.filePath) ? (
              <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 space-y-2">
                <div>This file was not included in the rendered output</div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const message = await createChatMessageAction(session, workspaceId, `Why was the file ${selectedFile.filePath} not included in the rendered output?`);
                    if (message && onFileUpdate) {
                      onFileUpdate(selectedFile);
                    }
                  }}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Why was this file not included?
                </Button>
              </div>
            ) : (
              selectedFile && (
                <CodeEditor
                  session={session}
                  file={selectedFile}
                  revision={revision}
                  theme={resolvedTheme}
                  value={editorContent}
                  onChange={onEditorChange}
                  onCommandK={onCommandK}
                  onFileUpdate={onFileUpdate}
                  files={files}
                  editorRef={editorRef}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
