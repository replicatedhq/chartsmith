import React from "react";
import { EditorNav } from "../EditorNav";
import { FileBrowser } from "../FileBrowser";
import { RenderedFileBrowser } from "../RenderedFileBrowser";
import { CodeEditor } from "../CodeEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { EditorView } from "../../../hooks/useEditorView";
import { useEffect } from "react";

import { WorkspaceFile, Chart, RenderedChart } from "@/lib/types/workspace";
import { Session } from "@/lib/types/session";

interface WorkspaceContainerProps {
  session: Session;
  view: EditorView;
  onViewChange: (newView: EditorView) => void;
  files: WorkspaceFile[];
  charts: Chart[];
  revision: number;
  renderedCharts: RenderedChart[];
  selectedFile?: WorkspaceFile;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileDelete: (path: string) => void;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  isFileTreeVisible: boolean;
  onCommandK?: () => void;
  onFileUpdate?: (file: WorkspaceFile) => void;
}

export function WorkspaceContainer({
  session,
  view,
  onViewChange,
  files,
  charts,
  renderedCharts,
  revision,
  selectedFile,
  onFileSelect,
  onFileDelete,
  editorContent,
  onEditorChange,
  isFileTreeVisible,
  onCommandK,
  onFileUpdate
}: WorkspaceContainerProps) {
  const { resolvedTheme } = useTheme();

  const handleViewChange = (newView: EditorView) => {
    onViewChange(newView);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] min-h-0 max-w-[calc(100vw-545px)] overflow-hidden">
      <EditorNav view={view} onViewChange={handleViewChange} />
      <div className="flex-1 flex min-h-0">
        <div className="w-[260px] flex-shrink-0">
          {isFileTreeVisible && (view === "source" ?
            (() => {
              return (
                <FileBrowser
                  nodes={files}
                  onFileSelect={onFileSelect}
                  onFileDelete={onFileDelete}
                  selectedFile={selectedFile}
                  charts={charts}
                />
              );
            })() :
            <RenderedFileBrowser
              charts={renderedCharts}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          )}
        </div>
        <div className={`w-px ${resolvedTheme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />
        <div className="flex-1 min-w-0 overflow-auto">
          {view === "source" && selectedFile && (
            <>
              <CodeEditor
                session={session}
                file={selectedFile}
                revision={revision}
                theme={resolvedTheme}
                value={editorContent}
                onChange={onEditorChange}
                onCommandK={() => {
                  console.log("WorkspaceContainer onCommandK handler called");
                  onCommandK?.();
                  console.log("WorkspaceContainer onCommandK handler finished");
                }}
                onFileUpdate={onFileUpdate}
                files={files}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
